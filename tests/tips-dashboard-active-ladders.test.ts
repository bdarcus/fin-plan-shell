import { describe, expect, test } from "bun:test";
import type { BondLadder } from "../src/lib/modules/tips-ladder/store/ladder";
import {
	getActiveLadderIncome,
	getActiveLadders,
	isLadderActiveInYear,
} from "../src/lib/modules/tips-ladder/lib/active-ladders";

const CURRENT_YEAR = 2026;

function createLadder(overrides: Partial<BondLadder>): BondLadder {
	return {
		id: overrides.id ?? crypto.randomUUID(),
		name: overrides.name ?? "Test Ladder",
		type: overrides.type ?? "simple-income",
		taxStatus: overrides.taxStatus ?? "taxable",
		startYear: overrides.startYear ?? CURRENT_YEAR,
		endYear: overrides.endYear ?? CURRENT_YEAR,
		annualIncome: overrides.annualIncome ?? 10000,
		...overrides,
	};
}

describe("tips dashboard active ladder metrics", () => {
	test("one active ladder and one future ladder only count active income", () => {
		const ladders = [
			createLadder({
				id: "active",
				name: "Active Ladder",
				startYear: 2025,
				endYear: 2028,
				annualIncome: 40000,
			}),
			createLadder({
				id: "future",
				name: "Future Ladder",
				startYear: 2027,
				endYear: 2032,
				annualIncome: 55000,
			}),
		];

		expect(
			getActiveLadders(ladders, CURRENT_YEAR).map((ladder) => ladder.id),
		).toEqual(["active"]);
		expect(getActiveLadderIncome(ladders, CURRENT_YEAR)).toBe(40000);
	});

	test("multiple active ladders all contribute to active metrics", () => {
		const ladders = [
			createLadder({
				id: "a",
				startYear: 2024,
				endYear: 2026,
				annualIncome: 25000,
			}),
			createLadder({
				id: "b",
				startYear: 2026,
				endYear: 2030,
				annualIncome: 35000,
			}),
			createLadder({
				id: "c",
				startYear: 2020,
				endYear: 2029,
				annualIncome: 15000,
			}),
		];

		expect(getActiveLadders(ladders, CURRENT_YEAR)).toHaveLength(3);
		expect(getActiveLadderIncome(ladders, CURRENT_YEAR)).toBe(75000);
	});

	test("only future ladders produce zero active income and zero active sources", () => {
		const ladders = [
			createLadder({
				id: "future-a",
				startYear: 2027,
				endYear: 2031,
				annualIncome: 30000,
			}),
			createLadder({
				id: "future-b",
				startYear: 2028,
				endYear: 2035,
				annualIncome: 45000,
			}),
		];

		expect(getActiveLadders(ladders, CURRENT_YEAR)).toHaveLength(0);
		expect(getActiveLadderIncome(ladders, CURRENT_YEAR)).toBe(0);
	});

	test("expired and future ladders are both excluded from active metrics", () => {
		const ladders = [
			createLadder({
				id: "expired",
				startYear: 2020,
				endYear: 2025,
				annualIncome: 20000,
			}),
			createLadder({
				id: "future",
				startYear: 2027,
				endYear: 2030,
				annualIncome: 50000,
			}),
		];

		expect(getActiveLadders(ladders, CURRENT_YEAR)).toHaveLength(0);
		expect(getActiveLadderIncome(ladders, CURRENT_YEAR)).toBe(0);
	});

	test("active check is inclusive of start and end year boundaries", () => {
		expect(
			isLadderActiveInYear(
				createLadder({ startYear: CURRENT_YEAR, endYear: CURRENT_YEAR + 5 }),
				CURRENT_YEAR,
			),
		).toBe(true);
		expect(
			isLadderActiveInYear(
				createLadder({ startYear: CURRENT_YEAR - 5, endYear: CURRENT_YEAR }),
				CURRENT_YEAR,
			),
		).toBe(true);
	});
});
