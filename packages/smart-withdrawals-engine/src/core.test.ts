import { describe, expect, test } from "bun:test";
import { runMonteCarlo } from "./monte-carlo";

describe("Smart Withdrawals Engine (Monte Carlo)", () => {
	test("Reports low floor-breach risk for a healthy portfolio", () => {
		const result = runMonteCarlo({
			startBalance: 1000000,
			equityAllocation: 0.6,
			years: 20,
			equityReturn: 0.05,
			equityVol: 0.15,
			tipsReturn: 0.02,
			bequestTarget: 0,
			incomeStreams: [],
			numSims: 400,
			seed: 12345,
			spendingFloor: 35000,
		});

		// Median first-year income is reasonable for this setup.
		expect(result.p50[0]).toBeGreaterThan(40000);
		expect(result.p50[0]).toBeLessThan(80000);

		// Breach risk should stay low for this conservative floor.
		expect(result.floorBreachPathRate).toBeLessThan(20);
		expect(result.floorBreachYearRate[0]).toBeLessThan(5);
		expect(result.worstRunLengthP95).toBeLessThan(5);
	});

	test("Higher floor and weaker inputs increase breach risk", () => {
		const result = runMonteCarlo({
			startBalance: 100000, // Very low balance
			equityAllocation: 0.6,
			years: 30,
			equityReturn: 0.05,
			equityVol: 0.25, // High vol
			tipsReturn: 0.01,
			bequestTarget: 0,
			incomeStreams: [],
			numSims: 400,
			seed: 12345,
			spendingFloor: 12000,
		});

		expect(result.floorBreachPathRate).toBeGreaterThan(60);
		expect(result.medianShortfallWhenBreached).toBeGreaterThan(500);
	});

	test("Monte Carlo outputs are deterministic for a fixed seed", () => {
		const params = {
			startBalance: 800000,
			equityAllocation: 0.5,
			years: 15,
			equityReturn: 0.045,
			equityVol: 0.13,
			tipsReturn: 0.018,
			bequestTarget: 50000,
			incomeStreams: [],
			numSims: 300,
			seed: 7,
			spendingFloor: 30000,
		} as const;
		const a = runMonteCarlo(params);
		const b = runMonteCarlo(params);
		expect(a).toEqual(b);
	});
});
