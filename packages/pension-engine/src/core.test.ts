import { describe, expect, test } from "bun:test";
import { calculatePensionStream } from "./core";

describe("Pension Engine", () => {
	test("Starts benefit payments at configured start year", () => {
		const result = calculatePensionStream(
			{
				annualBenefit: 24000,
				startYear: 2030,
				hasCOLA: false,
			},
			2026,
			10,
		);
		expect(result.annualAmounts[2029]).toBe(0);
		expect(result.annualAmounts[2030]).toBe(24000);
	});

	test("Carries COLA flag and respects horizon length", () => {
		const result = calculatePensionStream(
			{
				annualBenefit: 18000,
				startYear: 2026,
				hasCOLA: true,
			},
			2026,
			3,
		);
		expect(result.hasCOLA).toBe(true);
		expect(Object.keys(result.annualAmounts).length).toBe(3);
		expect(result.annualAmounts[2026]).toBe(18000);
		expect(result.annualAmounts[2028]).toBe(18000);
	});
});
