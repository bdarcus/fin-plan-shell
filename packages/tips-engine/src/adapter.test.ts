import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runRebalanceLegacyAdapter } from "./adapter";
import { getRefCpi, type TipsMapEntry, type TipsRefRow } from "./market-data";
import { loadTipsSnapshot20260302 } from "./test-fixtures/tips-market-2026-03-02";

function makeTipsMap(entries: TipsMapEntry[]): Map<string, TipsMapEntry> {
	return new Map(entries.map((entry) => [entry.cusip, entry]));
}

function loadRefCpiRows(): TipsRefRow[] {
	const csvPath = join(process.cwd(), "static/data/RefCPI.csv");
	const lines = readFileSync(csvPath, "utf-8").trim().split("\n");
	return lines
		.slice(1)
		.map((line) => line.split(","))
		.map((cols) => ({ date: cols[0], refCpi: Number.parseFloat(cols[1]) }))
		.filter((row) => row.date && Number.isFinite(row.refCpi));
}

function loadTipsMapFromStatic(
	settlementDate: string,
): Map<string, TipsMapEntry> {
	const csvPath = join(process.cwd(), "static/data/TipsYields.csv");
	const lines = readFileSync(csvPath, "utf-8").trim().split("\n");
	const refCpiRows = loadRefCpiRows();
	const currentRefCpi = getRefCpi(refCpiRows, settlementDate);

	const entries: TipsMapEntry[] = [];
	for (let i = 1; i < lines.length; i++) {
		const cols = lines[i].split(",");
		const price = Number.parseFloat(cols[5]);
		const yld = Number.parseFloat(cols[6]);
		const baseCpi = Number.parseFloat(cols[4]);
		if (!Number.isFinite(price) || !Number.isFinite(baseCpi)) continue;

		entries.push({
			cusip: cols[1],
			maturity: cols[2],
			coupon: Number.parseFloat(cols[3]),
			baseCpi,
			price,
			yield: Number.isFinite(yld) ? yld : null,
			indexRatio: currentRefCpi / baseCpi,
		});
	}

	return makeTipsMap(entries);
}

describe("TIPS Engine: Legacy Adapter", () => {
	test("maps buy trade cash effect to row[11] and clean approximation to row[10]", () => {
		const tipsMap = makeTipsMap([
			{
				cusip: "BOND-2026",
				maturity: "2026-04-15",
				coupon: 0.02,
				baseCpi: 100,
				price: 105,
				yield: 0.02,
				indexRatio: 1.1,
			},
		]);

		const result = runRebalanceLegacyAdapter({
			dara: 10000,
			startYear: 2026,
			endYear: 2026,
			holdings: [],
			tipsMap,
			settlementDate: new Date("2026-01-01"),
		});

		expect(result.results.length).toBe(1);
		expect(result.results[0][11]).toBeGreaterThan(0);
		expect(result.results[0][10]).toBeGreaterThan(0);
		expect(result.summary.primaryCostMode).toBe("clean");
		expect(result.summary.costDeltaSumClean).toBeCloseTo(
			result.results[0][10],
			6,
		);
		expect(result.summary.costDeltaSumAdjusted).toBeCloseTo(
			result.results[0][11],
			6,
		);
	});

	test("surfaces unmet income summary fields", () => {
		const tipsMap = makeTipsMap([
			{
				cusip: "BOND-2026",
				maturity: "2026-04-15",
				coupon: 0.02,
				baseCpi: 100,
				price: 100,
				yield: 0.02,
				indexRatio: 1.0,
			},
			{
				cusip: "BOND-2027",
				maturity: "2027-04-15",
				coupon: 0.02,
				baseCpi: 100,
				price: 100,
				yield: 0.02,
				indexRatio: 1.0,
			},
		]);

		const result = runRebalanceLegacyAdapter({
			dara: 10000,
			startYear: 2026,
			endYear: 2028,
			holdings: [],
			tipsMap,
			settlementDate: new Date("2026-01-01"),
		});

		expect(result.summary.hasUnmetIncome).toBe(true);
		expect(result.summary.unmetYears).toContain(2028);
		expect(result.summary.unmetIncomeTotal).toBeGreaterThan(0);
	});

	test("excludeCusips removes excluded bonds from candidate set", () => {
		const tipsMap = makeTipsMap([
			{
				cusip: "BOND-2026",
				maturity: "2026-04-15",
				coupon: 0.02,
				baseCpi: 100,
				price: 100,
				yield: 0.02,
				indexRatio: 1.0,
			},
			{
				cusip: "BOND-2027",
				maturity: "2027-04-15",
				coupon: 0.02,
				baseCpi: 100,
				price: 100,
				yield: 0.02,
				indexRatio: 1.0,
			},
		]);

		const result = runRebalanceLegacyAdapter({
			dara: 10000,
			startYear: 2026,
			endYear: 2027,
			holdings: [],
			tipsMap,
			excludeCusips: ["BOND-2027"],
			settlementDate: new Date("2026-01-01"),
		});

		expect(result.results.some((row) => row[0] === "BOND-2027")).toBe(false);
	});

	test("strategy=Cheapest does not exceed Default net cost in synthetic gap fixture", () => {
		const tipsMap = makeTipsMap([
			{
				cusip: "BOND-2027",
				maturity: "2027-04-15",
				coupon: 0.02,
				baseCpi: 100,
				price: 100,
				yield: 0.02,
				indexRatio: 1.0,
			},
			{
				cusip: "EXPENSIVE-2029",
				maturity: "2029-04-15",
				coupon: 0.02,
				baseCpi: 100,
				price: 140,
				yield: 0.02,
				indexRatio: 1.0,
			},
			{
				cusip: "CHEAP-2030",
				maturity: "2030-04-15",
				coupon: 0.02,
				baseCpi: 100,
				price: 70,
				yield: 0.02,
				indexRatio: 1.0,
			},
		]);

		const defaultResult = runRebalanceLegacyAdapter({
			dara: 10000,
			startYear: 2027,
			endYear: 2030,
			holdings: [],
			tipsMap,
			strategy: "Default",
			settlementDate: new Date("2026-01-01"),
		});
		const cheapestResult = runRebalanceLegacyAdapter({
			dara: 10000,
			startYear: 2027,
			endYear: 2030,
			holdings: [],
			tipsMap,
			strategy: "Cheapest",
			settlementDate: new Date("2026-01-01"),
		});

		expect(cheapestResult.summary.costDeltaSum).toBeLessThanOrEqual(
			defaultResult.summary.costDeltaSum,
		);
	});

	test("strategy=Cheapest keeps constrained shape and parity on 2032-2046 snapshot", () => {
		const benchmark = 625_613;
		const tolerance = 0.05;
		const lowerBound = benchmark * (1 - tolerance);
		const upperBound = benchmark * (1 + tolerance);
		const result = runRebalanceLegacyAdapter({
			dara: 60000,
			startYear: 2032,
			endYear: 2046,
			holdings: [],
			tipsMap: loadTipsSnapshot20260302(),
			strategy: "Cheapest",
			settlementDate: new Date("2026-03-02"),
		});

		expect(result.summary.hasUnmetIncome).toBe(false);
		expect(result.summary.unmetYears).toHaveLength(0);

		const buyRows = result.results.filter((row) => row[9] > 0);
		expect(buyRows.length).toBeGreaterThan(0);

		const hasOutOfHorizonMaturity = buyRows.some(
			(row) => Number(String(row[2]).slice(0, 4)) > 2046,
		);
		expect(hasOutOfHorizonMaturity).toBe(false);

		const totalAdjustedCost = buyRows.reduce((sum, row) => sum + row[11], 0);
		const costByCusip = new Map<string, number>();
		for (const row of buyRows) {
			const cusip = row[0];
			costByCusip.set(cusip, (costByCusip.get(cusip) || 0) + row[11]);
		}
		const maxShare = Math.max(
			...Array.from(costByCusip.values()).map(
				(cost) => cost / totalAdjustedCost,
			),
		);
		expect(maxShare).toBeLessThanOrEqual(0.35);

		expect(result.summary.costDeltaSumClean).toBeGreaterThanOrEqual(lowerBound);
		expect(result.summary.costDeltaSumClean).toBeLessThanOrEqual(upperBound);
		expect(result.summary.costDeltaSumAdjusted).toBeGreaterThan(730000);
		expect(result.summary.costDeltaSumAdjusted).toBeLessThan(820000);
	});

	test("clean-price benchmark reflects the post-fix reduced range for first full funding year", () => {
		const benchmark = 694_295;
		const tolerance = 0.03;
		const settlementDate = "2026-03-02";
		const result = runRebalanceLegacyAdapter({
			dara: 50000,
			startYear: 2027,
			endYear: 2045,
			holdings: [],
			tipsMap: loadTipsMapFromStatic(settlementDate),
			settlementDate: new Date(settlementDate),
		});

		const delta =
			Math.abs(result.summary.costDeltaSumClean - benchmark) / benchmark;
		expect(delta).toBeLessThanOrEqual(tolerance);
		expect(result.summary.costDeltaSumAdjusted).toBeGreaterThan(780000);
		expect(result.summary.costDeltaSumAdjusted).toBeLessThan(850000);

		const buyYears = new Set(
			result.results
				.filter((row) => row[9] > 0)
				.map((row) => Number(String(row[2]).slice(0, 4))),
		);
		expect(buyYears.has(2036)).toBe(true);
		expect(buyYears.has(2040)).toBe(true);
	});
});
