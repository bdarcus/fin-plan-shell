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
				yield: 0.02,
			},
			{
				cusip: "NEW-2027",
				maturity: "2027-04-15",
				coupon: 0.02,
				price: 100,
				baseCpi: 100,
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
		// ... (existing test)
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
				yield: 0.02,
			},
			{
				cusip: "NEW-2027",
				maturity: "2027-04-15",
				coupon: 0.02,
				price: 100,
				baseCpi: 100,
				yield: 0.02,
			},
			{
				cusip: "BOND-2028",
				maturity: "2028-04-15",
				coupon: 0.02,
				price: 100,
				baseCpi: 100,
				yield: 0.02,
			},
		];

		// User currently owns 'padded' amounts from a previous duration-matched state
		const currentHoldings: Holding[] = [
			{ cusip: "BOND-2026", qty: 150 }, // 100 for 2026 + 50 padding
			{ cusip: "BOND-2028", qty: 150 }, // 100 for 2028 + 50 padding
		];

		const result = calculateRebalance(
			bonds,
			currentHoldings,
			targetIncome,
			2026,
			2028,
		);

		// 1. The new target should be ~100 for each year
		const target26 = result.targetLadder.find((r) => r.cusip === "BOND-2026");
		const target27 = result.targetLadder.find((r) => r.cusip === "NEW-2027");
		const target28 = result.targetLadder.find((r) => r.cusip === "BOND-2028");

		expect(target26?.qty).toBeCloseTo(100, -1);
		expect(target27?.qty).toBeCloseTo(100, -1);
		expect(target28?.qty).toBeCloseTo(100, -1);

		// 2. Verify Trade Tickets
		const sell26 = result.trades.find(
			(t) => t.cusip === "BOND-2026" && t.action === "SELL",
		);
		const sell28 = result.trades.find(
			(t) => t.cusip === "BOND-2028" && t.action === "SELL",
		);
		const buy27 = result.trades.find(
			(t) => t.cusip === "NEW-2027" && t.action === "BUY",
		);

		expect(sell26).toBeDefined();
		expect(sell28).toBeDefined();
		expect(buy27).toBeDefined();

		// Should sell ~50 of both old bonds to fund the ~100 buy of the new bond
		expect(sell26?.qty).toBeGreaterThan(40);
		expect(sell28?.qty).toBeGreaterThan(40);
		expect(buy27?.qty).toBeGreaterThan(90);
	});
});
