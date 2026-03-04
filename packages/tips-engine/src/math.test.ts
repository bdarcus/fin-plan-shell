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

		const rung27 = result.rungs.find((r) => r.year === 2027)!;
		const rung26 = result.rungs.find((r) => r.year === 2026)!;

		expect(rung27.principal).toBe(9600);
		expect(rung26.principal).toBe(8700);
		expect(result.totalCost).toBe(9600 + 8700); // Because price is 100
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

	test("Gaps: Identifies and reports unmet income for missing years", () => {
		const bonds = createMockBonds([2026, 2028]); // 2027 is missing
		const targetIncome = 10000;
		const result = buildLadder(
			bonds,
			targetIncome,
			2026,
			2028,
			new Date("2026-01-01"),
		);

		expect(result.rungs.length).toBe(2);
		expect(result.unmetIncome[2027]).toBeDefined();
		// The unmet income in 2027 should be target - (coupons from 2028 bond)
		const rung28 = result.rungs.find((r) => r.year === 2028)!;
		const expectedUnmet = targetIncome - rung28.principal * 0.02;
		expect(result.unmetIncome[2027]).toBeCloseTo(expectedUnmet, 0);
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
			},
			{
				cusip: "BIG-2030",
				maturity: "2030-04-15",
				coupon: 0.5,
				price: 100,
				baseCpi: 100,
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

		// Year 2030 calculation: Need 10000. Qty = 10000 / 1.25 = 8000 par.
		// Coupon to 2029: 8000 * 0.50 = 4000.
		// Year 2029 calculation: Need 10000 - 4000 = 6000.
		// 6000 / 1.005 = 5970.14 -> rounds UP to 6000 par.

		const rung29 = result.rungs.find((r) => r.year === 2029);
		expect(rung29?.principal).toBe(6000);
		expect(result.rungs.length).toBe(2);
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
