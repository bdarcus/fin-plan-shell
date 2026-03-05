import { describe, expect, test } from "bun:test";
import { calculateSSIncomeStream } from "./core";

describe("Social Security Engine", () => {
	test("Correctly identifies start year based on claiming age", () => {
		const result = calculateSSIncomeStream(
			{
				currentAge: 62,
				claimingAge: 67,
				annualBenefit: 30000,
			},
			2026,
		);

		expect(result.startYear).toBe(2031);
		expect(result.stream.annualAmounts[2030]).toBe(0);
		expect(result.stream.annualAmounts[2031]).toBe(30000);
		expect(result.stream.annualAmounts[2050]).toBe(30000);
	});

	test("Immediate start if current age >= claiming age", () => {
		const result = calculateSSIncomeStream(
			{
				currentAge: 70,
				claimingAge: 67,
				annualBenefit: 30000,
			},
			2026,
		);

		expect(result.startYear).toBe(2026);
		expect(result.stream.annualAmounts[2026]).toBe(30000);
	});

	test("Rejects invalid claiming age and negative current age", () => {
		expect(() =>
			calculateSSIncomeStream(
				{
					currentAge: -1,
					claimingAge: 67,
					annualBenefit: 30000,
				},
				2026,
			),
		).toThrow("currentAge");
		expect(() =>
			calculateSSIncomeStream(
				{
					currentAge: 50,
					claimingAge: 61,
					annualBenefit: 30000,
				},
				2026,
			),
		).toThrow("claimingAge");
		expect(() =>
			calculateSSIncomeStream(
				{
					currentAge: 50,
					claimingAge: 71,
					annualBenefit: 30000,
				},
				2026,
			),
		).toThrow("claimingAge");
	});
});
