/**
 * Market Data utilities for TIPS.
 */

import {
	fetchFedInvestTips,
	pickFedInvestCleanPrice,
	type FedInvestPriceRow,
} from "./fedinvest";

export interface TipsMapEntry {
	cusip: string;
	maturity: string;
	coupon: number;
	baseCpi: number;
	price: number | null;
	yield: number | null;
	indexRatio: number;
	[key: string]: string | number | null;
}

export interface TipsRefRow {
	date: string;
	refCpi: number;
}

export interface MarketData {
	tipsMap: Map<string, TipsMapEntry>;
	refCpiRows: TipsRefRow[];
	settlementDate: Date;
	source: "fedinvest" | "local-csv";
	asOfDate: string;
	priceConvention: "clean";
}

export interface FetchMarketDataOptions {
	source?: "fedinvest" | "local-csv";
	fallbackToLocalCsv?: boolean;
}

type CsvRow = Record<string, string>;
type TipsRefCsvRow = {
	cusip: string;
	maturity: string;
	coupon: number;
	baseCpi: number;
};

/**
 * Returns the most recent RefCPI value whose date is on or before `dateStr`.
 * Throws a descriptive error if no matching row exists.
 */
export function getRefCpi(refCpiRows: TipsRefRow[], dateStr: string): number {
	for (let i = refCpiRows.length - 1; i >= 0; i--) {
		if (refCpiRows[i].date <= dateStr) return refCpiRows[i].refCpi;
	}
	throw new Error(`No RefCPI data available for settlement date: ${dateStr}`);
}

/**
 * Parses YYYY-MM-DD as a local date (preventing UTC shift).
 * Redefined here to keep the engine zero-dependency on the shell's shared utils.
 */
function parseLocalDate(str: string): Date {
	const [y, m, d] = str.split("-").map(Number);
	return new Date(y, m - 1, d);
}

function parseCsv(text: string): CsvRow[] {
	const lines = text
		.trim()
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
	if (lines.length < 2) return [];

	const headers = lines[0].split(",").map((s) => s.trim());
	return lines.slice(1).map((line) => {
		const values = line.split(",").map((s) => s.trim());
		return headers.reduce((row, key, i) => {
			row[key] = values[i] ?? "";
			return row;
		}, {} as CsvRow);
	});
}

function parseRefCpiRows(text: string): TipsRefRow[] {
	return parseCsv(text)
		.map((row) => ({
			date: row.date,
			refCpi: Number.parseFloat(row.refCpi),
		}))
		.filter((row) => row.date && Number.isFinite(row.refCpi));
}

function parseTipsRefRows(text: string): Map<string, TipsRefCsvRow> {
	const rows = parseCsv(text);
	const out = new Map<string, TipsRefCsvRow>();

	for (const row of rows) {
		const coupon = Number.parseFloat(row.coupon);
		const baseCpi = Number.parseFloat(row.baseCpi);
		if (!row.cusip || !row.maturity || !Number.isFinite(baseCpi)) continue;
		out.set(row.cusip, {
			cusip: row.cusip,
			maturity: row.maturity,
			coupon: Number.isFinite(coupon) ? coupon : 0,
			baseCpi,
		});
	}

	return out;
}

function parseYieldByCusip(text: string): Map<string, number> {
	const out = new Map<string, number>();
	for (const row of parseCsv(text)) {
		const yld = Number.parseFloat(row.yield);
		if (!row.cusip || !Number.isFinite(yld)) continue;
		out.set(row.cusip, yld);
	}
	return out;
}

async function fetchText(
	fetcher: typeof fetch,
	url: string,
	label: string,
): Promise<string> {
	const response = await fetcher(url);
	if (!response.ok) {
		throw new Error(
			`Failed to fetch ${label}: ${response.status} ${response.statusText}`,
		);
	}
	return response.text();
}

async function loadLocalCsvMarketData(
	fetcher: typeof fetch,
	basePath: string,
): Promise<MarketData> {
	const [yieldsText, refCpiText] = await Promise.all([
		fetchText(fetcher, `${basePath}/data/TipsYields.csv`, "TipsYields.csv"),
		fetchText(fetcher, `${basePath}/data/RefCPI.csv`, "RefCPI.csv"),
	]);

	const yields = parseCsv(yieldsText);
	if (yields.length === 0) {
		throw new Error("TipsYields.csv is empty or has no data rows.");
	}
	const refCpiRows = parseRefCpiRows(refCpiText);

	const asOfDate = yields[0].settlementDate;
	const settlementDate = parseLocalDate(asOfDate);
	const currentRefCpi = getRefCpi(refCpiRows, asOfDate);

	const tipsMap = new Map<string, TipsMapEntry>();
	for (const row of yields) {
		const price = Number.parseFloat(row.price);
		const yld = Number.parseFloat(row.yield);
		const baseCpi = Number.parseFloat(row.baseCpi);
		if (!row.cusip || !row.maturity || !Number.isFinite(baseCpi)) continue;

		tipsMap.set(row.cusip, {
			...row,
			cusip: row.cusip,
			maturity: row.maturity,
			coupon: Number.parseFloat(row.coupon),
			baseCpi,
			price: Number.isNaN(price) ? null : price,
			yield: Number.isNaN(yld) ? null : yld,
			indexRatio: currentRefCpi / baseCpi,
		} as TipsMapEntry);
	}

	return {
		tipsMap,
		refCpiRows,
		settlementDate,
		source: "local-csv",
		asOfDate,
		priceConvention: "clean",
	};
}

function mapFedInvestRow(
	row: FedInvestPriceRow,
	tipsRefByCusip: Map<string, TipsRefCsvRow>,
	yieldByCusip: Map<string, number>,
	currentRefCpi: number,
): TipsMapEntry | null {
	const ref = tipsRefByCusip.get(row.cusip);
	const cleanPrice = pickFedInvestCleanPrice(row);
	if (!ref || cleanPrice === null) return null;

	return {
		cusip: row.cusip,
		maturity: ref.maturity,
		coupon: Number.isFinite(row.rate) ? (row.rate as number) : ref.coupon,
		baseCpi: ref.baseCpi,
		price: cleanPrice,
		yield: yieldByCusip.get(row.cusip) ?? null,
		indexRatio: currentRefCpi / ref.baseCpi,
		securityType: row.securityType,
	} as TipsMapEntry;
}

async function loadFedInvestMarketData(
	fetcher: typeof fetch,
	basePath: string,
): Promise<MarketData> {
	const [fedInvest, refCpiText, tipsRefText, yieldsText] = await Promise.all([
		fetchFedInvestTips(fetcher),
		fetchText(fetcher, `${basePath}/data/RefCPI.csv`, "RefCPI.csv"),
		fetchText(fetcher, `${basePath}/data/TipsRef.csv`, "TipsRef.csv"),
		fetchText(fetcher, `${basePath}/data/TipsYields.csv`, "TipsYields.csv"),
	]);

	const refCpiRows = parseRefCpiRows(refCpiText);
	const tipsRefByCusip = parseTipsRefRows(tipsRefText);
	const yieldByCusip = parseYieldByCusip(yieldsText);

	const currentRefCpi = getRefCpi(refCpiRows, fedInvest.asOfDate);
	const settlementDate = parseLocalDate(fedInvest.asOfDate);
	const tipsMap = new Map<string, TipsMapEntry>();

	for (const row of fedInvest.rows) {
		const mapped = mapFedInvestRow(
			row,
			tipsRefByCusip,
			yieldByCusip,
			currentRefCpi,
		);
		if (!mapped) continue;
		tipsMap.set(mapped.cusip, mapped);
	}

	if (tipsMap.size === 0) {
		throw new Error("FedInvest data produced zero mappable TIPS rows.");
	}

	return {
		tipsMap,
		refCpiRows,
		settlementDate,
		source: "fedinvest",
		asOfDate: fedInvest.asOfDate,
		priceConvention: "clean",
	};
}

/**
 * Fetches market data using a provided fetch function (works in Browser or Node).
 */
export async function fetchMarketData(
	fetcher: typeof fetch = fetch,
	basePath: string = "",
	options: FetchMarketDataOptions = {},
): Promise<MarketData> {
	const source = options.source ?? "fedinvest";
	const fallbackToLocalCsv = options.fallbackToLocalCsv ?? true;

	if (source === "local-csv") {
		return loadLocalCsvMarketData(fetcher, basePath);
	}

	try {
		return await loadFedInvestMarketData(fetcher, basePath);
	} catch (error) {
		if (!fallbackToLocalCsv) throw error;
		return loadLocalCsvMarketData(fetcher, basePath);
	}
}
