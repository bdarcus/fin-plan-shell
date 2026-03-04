import { describe, expect, test } from "bun:test";
import { calculateConstantAmortization, projectPortfolio } from "./core";

describe("Portfolio Engine", () => {
	test("Amortization correctly exhausts principal over fixed horizon", () => {
		const balance = 1000000;
		const rate = 0.04; // 4% expected real return
		const horizon = 30;

		const income = calculateConstantAmortization(balance, rate, horizon);

		// At 4% real return over 30 years, you can theoretically spend ~$57.8k/yr
		// to hit exactly zero. This is the "Actuarial Max", not a "Safe Withdrawal Rate".
		expect(income).toBeCloseTo(57830, -1);

		// Verification: After 30 years of this spending, balance must be 0
		const projection = projectPortfolio(balance, rate, horizon, income);
		expect(projection[projection.length - 1]).toBeCloseTo(0, 0);
	});

	test("Handles bequest correctly", () => {
		const balance = 1000000;
		const rate = 0.05;
		const horizon = 20;
		const bequest = 500000;

		const income = calculateConstantAmortization(
			balance,
			rate,
			horizon,
			bequest,
		);
		const projection = projectPortfolio(balance, rate, horizon, income);

		// Final balance should equal bequest
		expect(projection[projection.length - 1]).toBeCloseTo(bequest, 0);
	});
});
