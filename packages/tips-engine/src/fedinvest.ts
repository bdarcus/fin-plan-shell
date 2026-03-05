const FEDINVEST_BASE_URL = "https://www.treasurydirect.gov/GA-FI/FedInvest";
const FEDINVEST_TODAY_HTML_URL = `${FEDINVEST_BASE_URL}/todaySecurityPriceDate.htm`;
const FEDINVEST_TODAY_CSV_URL = `${FEDINVEST_BASE_URL}/todaySecurityPriceDetail`;

const MONTH_TO_NUM: Record<string, number> = {
	Jan: 1,
	Feb: 2,
	Mar: 3,
	Apr: 4,
	May: 5,
	Jun: 6,
	Jul: 7,
	Aug: 8,
	Sep: 9,
	Oct: 10,
	Nov: 11,
	Dec: 12,
};

export interface FedInvestPriceRow {
	cusip: string;
	securityType: string;
	rate: number | null;
	maturityDate: string;
	callDate: string | null;
	buy: number | null;
	sell: number | null;
	endOfDay: number | null;
}

export interface FedInvestTipsData {
	asOfDate: string;
	rows: FedInvestPriceRow[];
}

function parseNumber(raw: string): number | null {
	const value = Number.parseFloat(raw);
	return Number.isFinite(value) ? value : null;
}

function toIsoDate(year: number, month: number, day: number): string {
	return `${year.toString().padStart(4, "0")}-${month
		.toString()
		.padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

export function parseFedInvestAsOfDate(html: string): string {
	const match = html.match(
		/Prices For:\s*([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})/,
	);
	if (!match) {
		throw new Error("Could not parse FedInvest as-of date.");
	}

	const month = MONTH_TO_NUM[match[1]];
	const day = Number.parseInt(match[2], 10);
	const year = Number.parseInt(match[3], 10);
	if (!month || !Number.isFinite(day) || !Number.isFinite(year)) {
		throw new Error("FedInvest as-of date was malformed.");
	}
	return toIsoDate(year, month, day);
}

export function parseFedInvestSlashDate(raw: string): string {
	const [m, d, y] = raw.split("/").map((part) => Number.parseInt(part, 10));
	if (!Number.isFinite(m) || !Number.isFinite(d) || !Number.isFinite(y)) {
		throw new Error(`Invalid FedInvest slash date: ${raw}`);
	}
	return toIsoDate(y, m, d);
}

export function parseFedInvestCsv(csvText: string): FedInvestPriceRow[] {
	const lines = csvText
		.trim()
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);

	return lines
		.map((line) => line.split(",").map((part) => part.trim()))
		.filter((cols) => cols.length >= 8)
		.map((cols) => ({
			cusip: cols[0],
			securityType: cols[1],
			rate: parseNumber(cols[2]),
			maturityDate: parseFedInvestSlashDate(cols[3]),
			callDate: cols[4] ? parseFedInvestSlashDate(cols[4]) : null,
			buy: parseNumber(cols[5]),
			sell: parseNumber(cols[6]),
			endOfDay: parseNumber(cols[7]),
		}));
}

export function pickFedInvestCleanPrice(row: FedInvestPriceRow): number | null {
	if (row.buy && row.buy > 0) return row.buy;
	if (row.sell && row.sell > 0) return row.sell;
	if (row.endOfDay && row.endOfDay > 0) return row.endOfDay;
	return null;
}

export async function fetchFedInvestTips(
	fetcher: typeof fetch = fetch,
): Promise<FedInvestTipsData> {
	const htmlRes = await fetcher(FEDINVEST_TODAY_HTML_URL);
	if (!htmlRes.ok) {
		throw new Error(
			`Failed to fetch FedInvest today page: ${htmlRes.status} ${htmlRes.statusText}`,
		);
	}
	const html = await htmlRes.text();
	const asOfDate = parseFedInvestAsOfDate(html);

	const csvRes = await fetcher(FEDINVEST_TODAY_CSV_URL, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: "fileType=csv&csv=CSV+FORMAT",
	});
	if (!csvRes.ok) {
		throw new Error(
			`Failed to fetch FedInvest today CSV: ${csvRes.status} ${csvRes.statusText}`,
		);
	}

	const rows = parseFedInvestCsv(await csvRes.text()).filter(
		(row) => row.securityType.toUpperCase() === "TIPS",
	);
	if (rows.length === 0) {
		throw new Error("FedInvest CSV did not contain any TIPS rows.");
	}

	return { asOfDate, rows };
}
