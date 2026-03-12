import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type BondInfo, buildLadder } from "./core";

// A small parser for the existing TipsYields.csv file to test with real data
function loadRealBonds(): BondInfo[] {
	const csvPath = join(process.cwd(), "static/data/TipsYields.csv");
	const content = readFileSync(csvPath, "utf-8");
	const lines = content.trim().split("\n");
	// settlementDate,cusip,maturity,coupon,baseCpi,price,yield
	const _headers = lines[0].split(",");

	const bonds: BondInfo[] = [];
	for (let i = 1; i < lines.length; i++) {
		if (!lines[i]) continue;
		const cols = lines[i].split(",");
		const maturity = cols[2];
		const price = parseFloat(cols[5]);
		if (Number.isNaN(price)) continue;

		bonds.push({
			cusip: cols[1],
			maturity: maturity,
			coupon: parseFloat(cols[3]),
			baseCpi: parseFloat(cols[4]),
			indexRatio: 1.0, // Default for tests unless parsing RefCPI
			price: price,
			yield: parseFloat(cols[6]),
		});
	}
	return bonds;
}

test("buildLadder generates a ladder for 5 years", () => {
	const bonds = loadRealBonds();
	const startYear = 2026;
	const endYear = 2030;
	const targetIncome = 40000;

	const result = buildLadder(
		bonds,
		targetIncome,
		startYear,
		endYear,
		new Date("2026-03-01"),
	);

	expect(result.rungs.length).toBeGreaterThan(0);
	expect(result.totalCost).toBeGreaterThan(0);

	// Verify unmet income is empty (no gaps in 2026-2030 usually)
	const gapYears = Object.keys(result.unmetIncome);
	expect(gapYears.length).toBe(0);

	// Verify first rung is 2026
	expect(result.rungs[0].year).toBe(2026);

	// Verify total cashflow roughly equals targetIncome for 2026
	// In 2026, we get: maturity of 2026 bond + half year coupon of 2026 bond
	// + full year coupons of 2027, 2028, 2029, 2030 bonds.
	// Let's manually sum it up:
	const rung26 = result.rungs.find((r) => r.year === 2026);
	let income26 = 0;
	if (rung26) {
		const bond26 = bonds.find((b) => b.cusip === rung26.cusip);
		if (bond26) {
			income26 += rung26.principal + (rung26.principal * bond26.coupon) / 2;
		}
	}

	for (const r of result.rungs) {
		if (r.year > 2026) {
			const b = bonds.find((bond) => bond.cusip === r.cusip);
			if (b) {
				income26 += r.principal * b.coupon;
			}
		}
	}

	// Should be very close to 40000. It might be slightly higher because we rounded qty up to whole bonds.
	expect(income26).toBeGreaterThanOrEqual(targetIncome);
	expect(income26).toBeLessThan(targetIncome + 2000); // within a reasonable rounding margin
});

const mockBonds: BondInfo[] = [
	{
		cusip: "BOND26",
		maturity: "2026-01-15",
		coupon: 0.05,
		price: 100,
		baseCpi: 100,
		indexRatio: 1,
		yield: 0.05,
	},
	{
		cusip: "BOND27",
		maturity: "2027-01-15",
		coupon: 0.05,
		price: 100,
		baseCpi: 100,
		indexRatio: 1,
		yield: 0.05,
	},
	{
		cusip: "BOND29",
		maturity: "2029-01-15",
		coupon: 0.05,
		price: 100,
		baseCpi: 100,
		indexRatio: 1,
		yield: 0.05,
	},
	{
		cusip: "BOND30",
		maturity: "2030-01-15",
		coupon: 0.05,
		price: 100,
		baseCpi: 100,
		indexRatio: 1,
		yield: 0.05,
	},
];

test("Pre-ladder interest reduces total cost (integration)", () => {
	const startYear = 2029;
	const endYear = 2030;
	const targetIncome = 10000;
	const settlementDate = new Date("2026-01-01");

	const resultWithoutInterest = buildLadder(
		mockBonds,
		targetIncome,
		startYear,
		endYear,
		{
			settlementDate,
			usePreLadderInterest: false,
			modelFidelity: "annual-approx",
		},
	);

	const resultWithInterest = buildLadder(
		mockBonds,
		targetIncome,
		startYear,
		endYear,
		{
			settlementDate,
			usePreLadderInterest: true,
			modelFidelity: "annual-approx",
		},
	);

	expect(resultWithInterest.totalCost).toBeLessThan(
		resultWithoutInterest.totalCost,
	);
});
