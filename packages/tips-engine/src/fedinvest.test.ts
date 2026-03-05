import { describe, expect, test } from "bun:test";
import {
	parseFedInvestAsOfDate,
	parseFedInvestCsv,
	pickFedInvestCleanPrice,
} from "./fedinvest";

describe("FedInvest parsing", () => {
	test("parses as-of date from today page HTML", () => {
		const html = "<h2>Prices For: Mar 2, 2026</h2>";
		expect(parseFedInvestAsOfDate(html)).toBe("2026-03-02");
	});

	test("parses CSV rows and normalizes maturity date", () => {
		const csv =
			"91282CDC2,TIPS,0.00125,10/15/2026,,100.375000,100.343750,0.000000\n";
		const rows = parseFedInvestCsv(csv);
		expect(rows).toHaveLength(1);
		expect(rows[0].cusip).toBe("91282CDC2");
		expect(rows[0].maturityDate).toBe("2026-10-15");
		expect(rows[0].rate).toBe(0.00125);
		expect(rows[0].buy).toBe(100.375);
		expect(rows[0].sell).toBe(100.34375);
	});

	test("clean price selection falls back from buy to sell", () => {
		expect(
			pickFedInvestCleanPrice({
				cusip: "A",
				securityType: "TIPS",
				rate: 0.01,
				maturityDate: "2026-10-15",
				callDate: null,
				buy: 101,
				sell: 100.5,
				endOfDay: null,
			}),
		).toBe(101);

		expect(
			pickFedInvestCleanPrice({
				cusip: "B",
				securityType: "TIPS",
				rate: 0.01,
				maturityDate: "2026-10-15",
				callDate: null,
				buy: 0,
				sell: 99.75,
				endOfDay: 99.8,
			}),
		).toBe(99.75);
	});
});
