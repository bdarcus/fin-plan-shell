import { describe, expect, test } from "bun:test";
import { type BondInfo, buildLadder } from "./core";

describe("TIPS Engine: Mathematical Invariants", () => {
	// Helper to create a perfect mock bond set (one per year)
	const createMockBonds = (
		years: number[],
		coupon: number = 0.02,
	): BondInfo[] => {
		return years.map((y) => ({
			cusip: `BOND-${y}`,
			maturity: `${y}-04-15`,
			coupon: coupon,
			price: 100, // Par
			baseCpi: 100,
			indexRatio: 1.0,
			yield: coupon, // Assume yield matches coupon for par bonds
		}));
	};

	test("Coupon Drip: Income from year 2 reduces need in year 1", () => {
		const bonds = createMockBonds([2026, 2027], 0.1); // 10% coupon for easy math
		const targetIncome = 10000;

		// Calculation:
		// 1. Year 2027: Need 10,000.
		//    Qty = 10000 / (1 + 0.10/2) = 10000 / 1.05 = 9523.8... -> $9600 par (96 bonds)
		//    Coupon Drip to 2026 = 9600 * 0.10 = $960
		// 2. Year 2026: Need = 10000 - 960 = 9040.
		//    Qty = 9040 / (1 + 0.10/2) = 8609.5... -> $8700 par (87 bonds)

		const result = buildLadder(
			bonds,
			targetIncome,
			2026,
			2027,
			new Date("2026-01-01"),
		);

		const rung27 = result.rungs.find((r) => r.year === 2027);
		const rung26 = result.rungs.find((r) => r.year === 2026);

		expect(rung27).toBeDefined();
		expect(rung26).toBeDefined();
		if (rung27 && rung26) {
			// Later-year coupon drip should reduce the earlier-year allocation.
			expect(rung26.principal).toBeLessThan(rung27.principal);
			expect(result.totalCost).toBe(rung27.principal + rung26.principal);
		}
		expect(Object.keys(result.unmetIncome)).toHaveLength(0);
	});

	test("Rounding: Always meets or exceeds target income", () => {
		const bonds = createMockBonds([2026, 2027, 2028], 0.0125);
		const targetIncome = 40000;
		const result = buildLadder(
			bonds,
			targetIncome,
			2026,
			2028,
			new Date("2026-01-01"),
		);

		// Check every year's total cashflow
		for (let year = 2026; year <= 2028; year++) {
			let totalCashflow = 0;
			for (const rung of result.rungs) {
				if (rung.year === year) {
					// Maturity: Principal + Last Half-Coupon
					totalCashflow += rung.principal * (1 + 0.0125 / 2);
				} else if (rung.year > year) {
					// Coupon from a bond that hasn't matured yet
					totalCashflow += rung.principal * 0.0125;
				}
			}
			expect(totalCashflow).toBeGreaterThanOrEqual(targetIncome);
		}
	});

	test("Gaps: reports unmet income when no in-horizon upper maturity exists", () => {
		const bonds = createMockBonds([2026, 2028]); // 2027 is missing
		const targetIncome = 10000;
		const result = buildLadder(
			bonds,
			targetIncome,
			2026,
			2028,
			new Date("2026-01-01"),
		);

		// 1. Should have 2 unique bonds in the ladder
		expect(result.rungs.length).toBe(2);

		const rung26 = result.rungs.find((r) => r.year === 2026);
		const rung28 = result.rungs.find((r) => r.year === 2028);

		expect(rung26).toBeDefined();
		expect(rung28).toBeDefined();

		expect(rung26?.qty).toBeGreaterThan(90);
		expect(rung28?.qty).toBeGreaterThan(90);
		expect(result.unmetIncome[2027]).toBeGreaterThan(0);
	});

	test("Strict mode: throws when liabilities are unmet", () => {
		const bonds = createMockBonds([2026], 0.02);
		expect(() =>
			buildLadder(bonds, 10000, 2026, 2028, {
				settlementDate: new Date("2026-01-01"),
				strictUnmetLiability: true,
			}),
		).toThrow();
	});

	test("Zero Need: Handles years fully covered by coupons", () => {
		// Year 2030 has a massive coupon that covers 2029 entirely
		const bonds: BondInfo[] = [
			{
				cusip: "BOND-2029",
				maturity: "2029-04-15",
				coupon: 0.01,
				price: 100,
				baseCpi: 100,
				indexRatio: 1.0,
				yield: 0.01,
			},
			{
				cusip: "BIG-2030",
				maturity: "2030-04-15",
				coupon: 0.5,
				price: 100,
				baseCpi: 100,
				indexRatio: 1.0,
				yield: 0.5,
			}, // 50% coupon!
		];
		const targetIncome = 10000;
		const result = buildLadder(
			bonds,
			targetIncome,
			2029,
			2030,
			new Date("2029-01-01"),
		);

		const rung29 = result.rungs.find((r) => r.year === 2029);
		expect(rung29?.principal).toBe(8000);
		expect(result.rungs.length).toBe(2);
		expect(Object.keys(result.unmetIncome)).toHaveLength(0);
	});

	test("Horizon guardrail: does not use out-of-horizon maturities by default", () => {
		const bonds = createMockBonds([2026, 2028, 2030], 0.02);
		const result = buildLadder(
			bonds,
			10000,
			2026,
			2028,
			new Date("2026-01-01"),
		);
		expect(result.rungs.some((r) => r.year > 2028)).toBe(false);
		expect(result.unmetIncome[2027]).toBeGreaterThan(0);
	});

	test("Market Reality: Handles 0% real yield (Price = 100)", () => {
		const bonds = createMockBonds([2026], 0.0); // 0% coupon, 0% yield
		const result = buildLadder(
			bonds,
			10000,
			2026,
			2026,
			new Date("2026-01-01"),
		);
		expect(result.rungs[0].principal).toBe(10000);
		expect(result.totalCost).toBe(10000);
	});

	test("Market Reality: Negative Yields (Price > 100)", () => {
		const bonds: BondInfo[] = [
			{
				cusip: "NEG-2026",
				maturity: "2026-04-15",
				coupon: 0.0,
				price: 105,
				baseCpi: 100,
				indexRatio: 1.0,
				yield: -0.05,
			},
		];
		const result = buildLadder(
			bonds,
			10000,
			2026,
			2026,
			new Date("2026-01-01"),
		);
		// Qty = 10000 / 1.0 = 10000 par.
		// Cost = 100 bonds * 105 price = 10500.
		expect(result.rungs[0].principal).toBe(10000);
		expect(result.totalCost).toBe(10500);
	});
});
