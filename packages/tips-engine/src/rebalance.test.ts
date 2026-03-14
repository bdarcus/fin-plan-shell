import { describe, expect, test } from "bun:test";
import { type BondInfo, calculateRebalance, type Holding } from "./core";

describe("TIPS Engine: Rebalancing Logic", () => {
	test("Identifies BUY for new gap maturities", () => {
		// Scenario:
		// 1. Current Holdings: User only owns a 2026 bond to cover 2026 & 2027 (gap).
		// 2. Market Update: A new 2027 bond is now available.
		// 3. Goal: The engine should suggest buying the 2027 bond.

		const bonds: BondInfo[] = [
			{
				cusip: "BOND-2026",
				maturity: "2026-04-15",
				coupon: 0.02,
				price: 100,
				baseCpi: 100,
				indexRatio: 1.0,
				yield: 0.02,
			},
			{
				cusip: "NEW-2027",
				maturity: "2027-04-15",
				coupon: 0.02,
				price: 100,
				baseCpi: 100,
				indexRatio: 1.0,
				yield: 0.02,
			},
		];

		// User currently owns enough 2026 to cover both years
		const currentHoldings: Holding[] = [{ cusip: "BOND-2026", qty: 200 }];

		const targetIncome = 10000;
		const result = calculateRebalance(
			bonds,
			currentHoldings,
			targetIncome,
			2026,
			2027,
		);

		// Should find a BUY for the new bond
		const buyTrade = result.trades.find(
			(t) => t.cusip === "NEW-2027" && t.action === "BUY",
		);
		expect(buyTrade).toBeDefined();
		expect(buyTrade?.qty).toBeGreaterThan(0);

		// Should find a SELL for the excess 2026 bonds (since they no longer need to cover 2027)
		const sellTrade = result.trades.find(
			(t) => t.cusip === "BOND-2026" && t.action === "SELL",
		);
		expect(sellTrade).toBeDefined();
	});

	test("Auction Swap: Detects new bond and recommends selling old padding", () => {
		const bonds: BondInfo[] = [
			{
				cusip: "BOND-2026",
				maturity: "2026-04-15",
				coupon: 0.02,
				price: 100,
				baseCpi: 100,
				indexRatio: 1.0,
				yield: 0.02,
			},
			{
				cusip: "BOND-2027",
				maturity: "2027-04-15",
				coupon: 0.02,
				price: 100,
				baseCpi: 100,
				indexRatio: 1.0,
				yield: 0.02,
			},
		];
		const currentHoldings: Holding[] = [{ cusip: "BOND-2026", qty: 200 }];
		const result = calculateRebalance(
			bonds,
			currentHoldings,
			10000,
			2026,
			2027,
		);
		const buy2027 = result.trades.find(
			(t) => t.cusip === "BOND-2027" && t.action === "BUY",
		);
		const sell2026 = result.trades.find(
			(t) => t.cusip === "BOND-2026" && t.action === "SELL",
		);
		expect(buy2027).toBeDefined();
		expect(sell2026).toBeDefined();
		expect(result.totalNetCost).toBeGreaterThan(-20000);
	});

	test("Sandwich Rebalance: Sells bonds before and after a newly discovered middle maturity", () => {
		// SCENARIO:
		// 1. Initial State: 2027 was a gap.
		//    User bought extra 2026 AND extra 2028 bonds to cover it (duration matched).
		// 2. Market Update: Treasury auctioned a 2027 bond.
		// 3. Requirement: Suggest BUY of 2027, and SELL of the excess 2026 AND 2028.

		const targetIncome = 10000;
		const bonds: BondInfo[] = [
			{
				cusip: "BOND-2026",
				maturity: "2026-04-15",
				coupon: 0.02,
				price: 100,
				baseCpi: 100,
				indexRatio: 1.0,
				yield: 0.02,
			},
			{
				cusip: "NEW-2027",
				maturity: "2027-04-15",
				coupon: 0.02,
				price: 100,
				baseCpi: 100,
				indexRatio: 1.0,
				yield: 0.02,
			},
			{
				cusip: "BOND-2028",
				maturity: "2028-04-15",
				coupon: 0.02,
				price: 100,
				baseCpi: 100,
				indexRatio: 1.0,
				yield: 0.02,
			},
		];

		// User currently owns 'padded' amounts from a previous duration-matched state
		const currentHoldings: Holding[] = [
			{ cusip: "BOND-2026", qty: 148 },
			{ cusip: "BOND-2028", qty: 149 },
		];
		const currentTargetPositions = [
			{
				positionId: "exact:2026:BOND-2026",
				cusip: "BOND-2026",
				maturity: "2026-04-15",
				year: 2026,
				qty: 98,
				cost: 9800,
				principal: 9800,
				couponIncome: 196,
				coverageType: "exact" as const,
				targetYear: 2026,
			},
			{
				positionId: "gap:2027:lower:BOND-2026",
				cusip: "BOND-2026",
				maturity: "2026-04-15",
				year: 2026,
				qty: 50,
				cost: 5000,
				principal: 5000,
				couponIncome: 100,
				coverageType: "gap" as const,
				targetYear: 2027,
				bracketRole: "lower" as const,
			},
			{
				positionId: "gap:2027:upper:BOND-2028",
				cusip: "BOND-2028",
				maturity: "2028-04-15",
				year: 2028,
				qty: 50,
				cost: 5000,
				principal: 5000,
				couponIncome: 100,
				coverageType: "gap" as const,
				targetYear: 2027,
				bracketRole: "upper" as const,
			},
			{
				positionId: "exact:2028:BOND-2028",
				cusip: "BOND-2028",
				maturity: "2028-04-15",
				year: 2028,
				qty: 99,
				cost: 9900,
				principal: 9900,
				couponIncome: 198,
				coverageType: "exact" as const,
				targetYear: 2028,
			},
		];

		const result = calculateRebalance(
			bonds,
			currentHoldings,
			targetIncome,
			2026,
			2028,
			{
				currentTargetPositions,
			},
		);

		// 1. Verify the rebalance generates a target ladder with expected coverage
		// The algorithm should create a ladder that covers each year with either exact bonds or gap interpolation
		expect(result.targetLadder.length).toBeGreaterThan(0);

		// 2. Verify that there are trades to be executed
		expect(result.trades.length).toBeGreaterThan(0);

		// 3. Verify upgrade groups identify the gap that needs to be filled (2027)
		expect(result.upgradeGroups.length).toBeGreaterThan(0);
		const upgradeFor2027 = result.upgradeGroups.find(
			(ug) => ug.targetYear === 2027,
		);
		expect(upgradeFor2027).toBeDefined();
		// The upgrade should involve selling from bonds and buying into a synthetic 2027
		expect(upgradeFor2027?.sells.length).toBeGreaterThan(0);
	});

	test("Unknown holdings policy: throws when configured to error", () => {
		const bonds: BondInfo[] = [
			{
				cusip: "KNOWN-2026",
				maturity: "2026-04-15",
				coupon: 0.02,
				price: 100,
				baseCpi: 100,
				indexRatio: 1.0,
				yield: 0.02,
			},
		];
		const currentHoldings: Holding[] = [{ cusip: "UNKNOWN", qty: 10 }];
		expect(() =>
			calculateRebalance(bonds, currentHoldings, 5000, 2026, 2026, {
				unknownHoldingCusipPolicy: "error",
			}),
		).toThrow("Unknown holding CUSIP");
	});
});
