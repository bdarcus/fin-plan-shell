import { describe, expect, test } from "bun:test";
import { runMonteCarlo } from "./monte-carlo";

describe("Smart Withdrawals Engine (Monte Carlo)", () => {
	test("Income is generated and success rate is high for safe withdrawal", () => {
		const result = runMonteCarlo({
			startBalance: 1000000,
			equityAllocation: 0.6,
			years: 20,
			equityReturn: 0.05,
			equityVol: 0.15,
			tipsReturn: 0.02,
			bequestTarget: 0,
			incomeStreams: [],
			numSims: 100,
		});

		// Median income should be roughly in the 4-6% range of starting balance
		expect(result.p50[0]).toBeGreaterThan(40000);
		expect(result.p50[0]).toBeLessThan(80000);

		// Success rate for a standard 60/40 over 20 years should be high
		expect(result.successRate).toBeGreaterThan(70);
	});

	test("Failed scenario has lower success rate", () => {
		const result = runMonteCarlo({
			startBalance: 100000, // Very low balance
			equityAllocation: 0.6,
			years: 30,
			equityReturn: 0.05,
			equityVol: 0.25, // High vol
			tipsReturn: 0.01,
			bequestTarget: 0,
			incomeStreams: [],
			numSims: 100,
		});

		// With high vol and low balance, success rate should be significantly impacted
		expect(result.successRate).toBeLessThan(90);
	});
});
