import { describe, expect, test } from "bun:test";
import {
	calculateTargetHorizon,
	getJointSurvivalProb,
	getProbSurvivingNYears,
	getTargetProbFromMargin,
} from "./life-expectancy";

describe("Life Expectancy Engine", () => {
	test("Survival probability declines with time", () => {
		const p10 = getProbSurvivingNYears(65, "male", 10);
		const p20 = getProbSurvivingNYears(65, "male", 20);
		expect(p10).toBeGreaterThan(p20);
		expect(p20).toBeGreaterThan(0);
	});

	test("Joint survival with two people is >= each individual survival", () => {
		const people = [
			{ age: 65, gender: "male" as const },
			{ age: 65, gender: "female" as const },
		];
		const joint = getJointSurvivalProb(people, 20);
		const male = getProbSurvivingNYears(65, "male", 20);
		const female = getProbSurvivingNYears(65, "female", 20);
		expect(joint).toBeGreaterThanOrEqual(male);
		expect(joint).toBeGreaterThanOrEqual(female);
	});

	test("Conservatism margin mapping is monotonic", () => {
		const aggressive = getTargetProbFromMargin(0);
		const conservative = getTargetProbFromMargin(1);
		expect(aggressive).toBe(0.5);
		expect(conservative).toBeCloseTo(0.05, 8);
		expect(aggressive).toBeGreaterThan(conservative);
	});

	test("Lower target survival probability yields longer target horizon", () => {
		const people = [{ age: 65, gender: "female" as const }];
		const horizon50 = calculateTargetHorizon(people, 0.5);
		const horizon10 = calculateTargetHorizon(people, 0.1);
		expect(horizon10).toBeGreaterThan(horizon50);
	});
});
