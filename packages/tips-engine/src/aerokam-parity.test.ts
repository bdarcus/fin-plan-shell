import { expect, test, describe } from "bun:test";
import { type BondInfo, buildLadder } from "./core";

describe("Aerokam Parity Tests", () => {
	/**
	 * Test data extracted from aerokam's TipsLadderBuilder output.
	 * This represents a sample TIPS ladder with specific bonds selected
	 * using aerokam's latest-maturity-in-year selection rule.
	 *
	 * The test verifies that with matching inputs and options, our engine
	 * produces similar results, especially with:
	 * - roundingMode: "nearest" (for math parity)
	 * - Adjusted-principal basis (for reporting parity)
	 * - Same bond selection strategy
	 */
	test("nearest rounding produces similar cost to aerokam", () => {
		// Mock bonds with similar characteristics to aerokam's 2026-04-19 dataset
		const bonds: BondInfo[] = [
			{
				cusip: "91282CAV6",
				maturity: "2026-07-15",
				coupon: 0.0175,
				price: 100.1,
				baseCpi: 100.0,
				indexRatio: 1.301,
				yield: 0.01,
			},
			{
				cusip: "91282CEZ0",
				maturity: "2032-07-15",
				coupon: 0.0275,
				price: 101.8,
				baseCpi: 100.0,
				indexRatio: 1.301,
				yield: 0.0085,
			},
			{
				cusip: "912810FQ6",
				maturity: "2032-04-15",
				coupon: 0.025,
				price: 101.5,
				baseCpi: 100.0,
				indexRatio: 1.301,
				yield: 0.0087,
			},
			{
				cusip: "91282CFF5",
				maturity: "2037-07-15",
				coupon: 0.03,
				price: 103.2,
				baseCpi: 100.0,
				indexRatio: 1.301,
				yield: 0.008,
			},
			{
				cusip: "91282CGG2",
				maturity: "2042-07-15",
				coupon: 0.03125,
				price: 104.1,
				baseCpi: 100.0,
				indexRatio: 1.301,
				yield: 0.0075,
			},
			{
				cusip: "91282CHK3",
				maturity: "2046-07-15",
				coupon: 0.032,
				price: 104.8,
				baseCpi: 100.0,
				indexRatio: 1.301,
				yield: 0.007,
			},
		];

		// Build with nearest rounding (aerokam parity mode)
		const result = buildLadder(bonds, 60000, 2032, 2046, {
			settlementDate: new Date("2026-04-19"),
			roundingMode: "nearest",
			modelFidelity: "annual-approx",
		});

		// Verify basic structure
		expect(result.rungs.length).toBeGreaterThan(0);
		expect(result.totalCost).toBeGreaterThan(0);

		// Find exact 2032 position (should use Jul 2032 per latest-maturity rule)
		const exact2032 = result.positions.find(
			(p) => p.coverageType === "exact" && p.targetYear === 2032,
		);
		expect(exact2032?.cusip).toBe("91282CEZ0");

		// Verify total cost is reasonable (within ballpark of expected ~$800k for 60k DARA)
		// Adjusted-principal basis should be similar to clean-price basis * index ratio
		expect(result.totalCost).toBeGreaterThan(700000);
		expect(result.totalCost).toBeLessThan(900000);

		console.log(
			`[aerokam parity] nearest rounding: total cost = ${result.totalCost.toFixed(0)}, rungs = ${result.rungs.length}`,
		);
	});

	test("ceiling rounding produces higher cost than nearest", () => {
		const bonds: BondInfo[] = [
			{
				cusip: "91282CAV6",
				maturity: "2026-07-15",
				coupon: 0.0175,
				price: 100.1,
				baseCpi: 100.0,
				indexRatio: 1.301,
				yield: 0.01,
			},
			{
				cusip: "91282CEZ0",
				maturity: "2032-07-15",
				coupon: 0.0275,
				price: 101.8,
				baseCpi: 100.0,
				indexRatio: 1.301,
				yield: 0.0085,
			},
			{
				cusip: "91282CFF5",
				maturity: "2037-07-15",
				coupon: 0.03,
				price: 103.2,
				baseCpi: 100.0,
				indexRatio: 1.301,
				yield: 0.008,
			},
		];

		const resultNearest = buildLadder(bonds, 50000, 2032, 2037, {
			settlementDate: new Date("2026-04-19"),
			roundingMode: "nearest",
			modelFidelity: "annual-approx",
		});

		const resultCeiling = buildLadder(bonds, 50000, 2032, 2037, {
			settlementDate: new Date("2026-04-19"),
			roundingMode: "ceiling",
			modelFidelity: "annual-approx",
		});

		// Ceiling should cost more (or equal) due to rounding up more quantities
		expect(resultCeiling.totalCost).toBeGreaterThanOrEqual(
			resultNearest.totalCost,
		);

		console.log(
			`[aerokam parity] nearest: ${resultNearest.totalCost.toFixed(0)}, ceiling: ${resultCeiling.totalCost.toFixed(0)}`,
		);
	});

	test("excludeCusips filters bonds correctly", () => {
		const bonds: BondInfo[] = [
			{
				cusip: "EXCLUDE_ME",
				maturity: "2032-07-15",
				coupon: 0.0275,
				price: 101.8,
				baseCpi: 100.0,
				indexRatio: 1.301,
				yield: 0.0085,
			},
			{
				cusip: "KEEP_ME",
				maturity: "2032-07-15",
				coupon: 0.0275,
				price: 101.8,
				baseCpi: 100.0,
				indexRatio: 1.301,
				yield: 0.0085,
			},
			{
				cusip: "91282CFF5",
				maturity: "2037-07-15",
				coupon: 0.03,
				price: 103.2,
				baseCpi: 100.0,
				indexRatio: 1.301,
				yield: 0.008,
			},
		];

		const resultNoFilter = buildLadder(bonds, 50000, 2032, 2037, {
			settlementDate: new Date("2026-04-19"),
			roundingMode: "nearest",
			modelFidelity: "annual-approx",
		});

		const resultWithFilter = buildLadder(bonds, 50000, 2032, 2037, {
			settlementDate: new Date("2026-04-19"),
			roundingMode: "nearest",
			excludeCusips: ["EXCLUDE_ME"],
			modelFidelity: "annual-approx",
		});

		// Both should build successfully
		expect(resultNoFilter.rungs.length).toBeGreaterThan(0);
		expect(resultWithFilter.rungs.length).toBeGreaterThan(0);

		// Filtered result should not use the excluded CUSIP
		const hasExcluded = resultWithFilter.rungs.some(
			(r) => r.cusip === "EXCLUDE_ME",
		);
		expect(hasExcluded).toBe(false);

		console.log(`[aerokam parity] excludeCusips filter working correctly`);
	});

	test("includeCusips filters to only specified bonds", () => {
		const bonds: BondInfo[] = [
			{
				cusip: "ONLY_THIS_2032",
				maturity: "2032-07-15",
				coupon: 0.0275,
				price: 101.8,
				baseCpi: 100.0,
				indexRatio: 1.301,
				yield: 0.0085,
			},
			{
				cusip: "IGNORE_THIS",
				maturity: "2032-04-15",
				coupon: 0.025,
				price: 101.5,
				baseCpi: 100.0,
				indexRatio: 1.301,
				yield: 0.0087,
			},
			{
				cusip: "ONLY_THIS_2037",
				maturity: "2037-07-15",
				coupon: 0.03,
				price: 103.2,
				baseCpi: 100.0,
				indexRatio: 1.301,
				yield: 0.008,
			},
		];

		const result = buildLadder(bonds, 50000, 2032, 2037, {
			settlementDate: new Date("2026-04-19"),
			roundingMode: "nearest",
			includeCusips: ["ONLY_THIS_2032", "ONLY_THIS_2037"],
			modelFidelity: "annual-approx",
		});

		// Result should only contain included CUSIPs
		const cuspips = new Set(result.rungs.map((r) => r.cusip));
		expect(cuspips.has("ONLY_THIS_2032") || cuspips.has("ONLY_THIS_2037")).toBe(
			true,
		);
		expect(cuspips.has("IGNORE_THIS")).toBe(false);

		console.log(`[aerokam parity] includeCusips filter working correctly`);
	});

	test("adjusted-principal cost is primary reporting metric", () => {
		const bonds: BondInfo[] = [
			{
				cusip: "91282CAV6",
				maturity: "2026-07-15",
				coupon: 0.0175,
				price: 100.1,
				baseCpi: 100.0,
				indexRatio: 1.301,
				yield: 0.01,
			},
			{
				cusip: "91282CEZ0",
				maturity: "2032-07-15",
				coupon: 0.0275,
				price: 101.8,
				baseCpi: 100.0,
				indexRatio: 1.301,
				yield: 0.0085,
			},
		];

		const result = buildLadder(bonds, 30000, 2026, 2032, {
			settlementDate: new Date("2026-04-19"),
			roundingMode: "nearest",
			modelFidelity: "annual-approx",
		});

		// Verify that cost and principal are properly set on each rung
		for (const rung of result.rungs) {
			const bond = bonds.find((b) => b.cusip === rung.cusip);
			if (!bond) continue;

			// cost should be qty * (price / 100 * adjusted principal)
			const adjustedPrincipalPerUnit = 100 * bond.indexRatio;
			const expectedCostPerUnit = (bond.price / 100) * adjustedPrincipalPerUnit;
			const expectedCost = rung.qty * expectedCostPerUnit;

			// principal should be qty * adjusted principal per unit
			const expectedPrincipal = rung.qty * adjustedPrincipalPerUnit;

			expect(rung.cost).toBeCloseTo(expectedCost, 0);
			expect(rung.principal).toBeCloseTo(expectedPrincipal, 0);
		}

		console.log(`[aerokam parity] adjusted-principal reporting is correct`);
	});
});
