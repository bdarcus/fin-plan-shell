/**
 * Market Data utilities for TIPS.
 */

export interface MarketData {
	tipsMap: Map<string, any>;
	refCpiRows: { date: string; refCpi: number }[];
	settlementDate: Date;
}

/**
 * Returns the most recent RefCPI value whose date is on or before `dateStr`.
 * Throws a descriptive error if no matching row exists.
 */
export function getRefCpi(
	refCpiRows: { date: string; refCpi: number }[],
	dateStr: string,
): number {
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

/**
 * Fetches market data using a provided fetch function (works in Browser or Node).
 */
export async function fetchMarketData(fetcher: typeof fetch = fetch): Promise<MarketData> {
	const [yRes, rRes] = await Promise.all([
		fetcher("/data/TipsYields.csv"),
		fetcher("/data/RefCPI.csv"),
	]);

	if (!yRes.ok)
		throw new Error(
			`Failed to fetch TipsYields.csv: ${yRes.status} ${yRes.statusText}`,
		);
	if (!rRes.ok)
		throw new Error(
			`Failed to fetch RefCPI.csv: ${rRes.status} ${rRes.statusText}`,
		);

	const parseCsv = (text: string) => {
		const lines = text
			.trim()
			.split("\n")
			.filter((l) => l.trim());
		if (lines.length < 2) return [];
		const headers = lines[0].split(",").map((s) => s.trim());
		return lines.slice(1).map((line) => {
			const values = line.split(",").map((s) => s.trim());
			return headers.reduce((obj, key, i) => ({ ...obj, [key]: values[i] }), {} as any);
		});
	};

	const yields = parseCsv(await yRes.text());
	if (yields.length === 0)
		throw new Error("TipsYields.csv is empty or has no data rows.");

	const refCpiRows = parseCsv(await rRes.text()).map((r: any) => ({
		date: r.date,
		refCpi: parseFloat(r.refCpi),
	}));

	const settlementDate = parseLocalDate(yields[0].settlementDate);
	
	// Convert to a Map for legacy compatibility with the UI
	const tipsMap = new Map<string, any>();
	for (const row of yields) {
		const price = parseFloat(row.price);
		const yld = parseFloat(row.yield);
		tipsMap.set(row.cusip, {
			...row,
			coupon: parseFloat(row.coupon),
			baseCpi: parseFloat(row.baseCpi),
			price: Number.isNaN(price) ? null : price,
			yield: Number.isNaN(yld) ? null : yld,
		});
	}

	return { tipsMap, refCpiRows, settlementDate };
}
