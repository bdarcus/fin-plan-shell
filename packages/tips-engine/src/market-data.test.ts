import { describe, expect, test } from "bun:test";
import { fetchMarketData } from "./market-data";

function getUrl(input: RequestInfo | URL): string {
	if (typeof input === "string") return input;
	if (input instanceof URL) return input.toString();
	return input.url;
}

function makeMockFetch(
	responder: (url: string, init?: RequestInit) => Response | Promise<Response>,
): typeof fetch {
	return async (input: RequestInfo | URL, init?: RequestInit) =>
		responder(getUrl(input), init);
}

const REF_CPI_CSV = `date,refCpi
2026-03-01,325.0
2026-03-02,325.1
`;

const TIPS_REF_CSV = `cusip,maturity,datedDate,coupon,baseCpi,term
91282CDC2,2026-10-15,2021-10-15,0.00125,273.25771,5-Year
`;

const TIPS_YIELDS_CSV = `settlementDate,cusip,maturity,coupon,baseCpi,price,yield
2026-03-02,91282CDC2,2026-10-15,0.00125,273.25771,100.25,-0.00277017
`;

describe("Market Data loading", () => {
	test("loads FedInvest source and maps metadata + pricing", async () => {
		const mockFetch = makeMockFetch((url) => {
			if (url.endsWith("/todaySecurityPriceDate.htm")) {
				return new Response("<h2>Prices For: Mar 2, 2026</h2>", {
					status: 200,
				});
			}
			if (url.endsWith("/todaySecurityPriceDetail")) {
				return new Response(
					[
						"91282CDC2,TIPS,0.00125,10/15/2026,,100.375000,100.343750,0.000000",
						"912797SY4,MARKET BASED BILL,0.0,03/10/2026,,0.000000,99.949583,0.000000",
					].join("\n"),
					{ status: 200 },
				);
			}
			if (url.endsWith("/data/RefCPI.csv")) {
				return new Response(REF_CPI_CSV, { status: 200 });
			}
			if (url.endsWith("/data/TipsRef.csv")) {
				return new Response(TIPS_REF_CSV, { status: 200 });
			}
			if (url.endsWith("/data/TipsYields.csv")) {
				return new Response(TIPS_YIELDS_CSV, { status: 200 });
			}
			return new Response("Not Found", { status: 404 });
		});

		const marketData = await fetchMarketData(mockFetch, "", {
			source: "fedinvest",
			fallbackToLocalCsv: false,
		});

		expect(marketData.source).toBe("fedinvest");
		expect(marketData.asOfDate).toBe("2026-03-02");
		expect(marketData.priceConvention).toBe("clean");
		expect(marketData.settlementDate.getFullYear()).toBe(2026);
		expect(marketData.tipsMap.size).toBe(1);

		const row = marketData.tipsMap.get("91282CDC2");
		expect(row?.price).toBe(100.375);
		expect(row?.yield).toBe(-0.00277017);
		expect(row?.indexRatio).toBeCloseTo(325.1 / 273.25771, 9);
	});

	test("falls back to local CSV source when FedInvest fetch fails", async () => {
		const mockFetch = makeMockFetch((url) => {
			if (url.includes("treasurydirect.gov/GA-FI/FedInvest/")) {
				throw new Error("CORS blocked");
			}
			if (url.endsWith("/data/RefCPI.csv")) {
				return new Response(REF_CPI_CSV, { status: 200 });
			}
			if (url.endsWith("/data/TipsYields.csv")) {
				return new Response(TIPS_YIELDS_CSV, { status: 200 });
			}
			return new Response("Not Found", { status: 404 });
		});

		const marketData = await fetchMarketData(mockFetch, "", {
			source: "fedinvest",
			fallbackToLocalCsv: true,
		});

		expect(marketData.source).toBe("local-csv");
		expect(marketData.asOfDate).toBe("2026-03-02");
		expect(marketData.tipsMap.has("91282CDC2")).toBe(true);
	});

	test("throws if FedInvest fails and fallback is disabled", async () => {
		const mockFetch = makeMockFetch((url) => {
			if (url.includes("treasurydirect.gov/GA-FI/FedInvest/")) {
				throw new Error("CORS blocked");
			}
			return new Response("Not Found", { status: 404 });
		});

		await expect(
			fetchMarketData(mockFetch, "", {
				source: "fedinvest",
				fallbackToLocalCsv: false,
			}),
		).rejects.toThrow("CORS blocked");
	});
});
