import { expect, test, describe } from "bun:test";
import { calculateRebalance, type BondInfo, type Holding } from "./core";

describe("TIPS Engine: Rebalancing Logic", () => {
    
    test("Identifies BUY for new gap maturities", () => {
        // Scenario: 
        // 1. Current Holdings: User only owns a 2026 bond to cover 2026 & 2027 (gap).
        // 2. Market Update: A new 2027 bond is now available.
        // 3. Goal: The engine should suggest buying the 2027 bond.

        const bonds: BondInfo[] = [
            { cusip: "BOND-2026", maturity: "2026-04-15", coupon: 0.02, price: 100, baseCpi: 100 },
            { cusip: "NEW-2027",  maturity: "2027-04-15", coupon: 0.02, price: 100, baseCpi: 100 }
        ];

        // User currently owns enough 2026 to cover both years
        const currentHoldings: Holding[] = [
            { cusip: "BOND-2026", qty: 200 } 
        ];

        const targetIncome = 10000;
        const result = calculateRebalance(bonds, currentHoldings, targetIncome, 2026, 2027);

        // Should find a BUY for the new bond
        const buyTrade = result.trades.find(t => t.cusip === "NEW-2027" && t.action === "BUY");
        expect(buyTrade).toBeDefined();
        expect(buyTrade?.qty).toBeGreaterThan(0);

        // Should find a SELL for the excess 2026 bonds (since they no longer need to cover 2027)
        const sellTrade = result.trades.find(t => t.cusip === "BOND-2026" && t.action === "SELL");
        expect(sellTrade).toBeDefined();
    });

    test("Auction Swap: Detects new bond and recommends selling old padding", () => {
        // SCENARIO:
        // Initial state: 2027 was a gap. User bought extra 2026 bonds to cover it.
        // Current state: Treasury auctioned a 2027 bond.
        // Requirement: Suggest SELL of the 2026 'padding' and BUY of the new 2027 bond.

        const targetIncome = 10000;
        const bonds: BondInfo[] = [
            { cusip: "EXISTING-2026", maturity: "2026-04-15", coupon: 0.02, price: 100, baseCpi: 100 },
            { cusip: "NEW-AUCTION-2027", maturity: "2027-04-15", coupon: 0.02, price: 100, baseCpi: 100 }
        ];

        // User owns 200 bonds of 2026 (100 for 2026, 100 to 'pad' the 2027 gap)
        const currentHoldings: Holding[] = [
            { cusip: "EXISTING-2026", qty: 200 }
        ];

        const result = calculateRebalance(bonds, currentHoldings, targetIncome, 2026, 2027);

        // 1. Verify the Target State
        // Ideal: 100 bonds of 2026, 100 bonds of 2027 (approx)
        const target26 = result.targetLadder.find(r => r.cusip === "EXISTING-2026");
        const target27 = result.targetLadder.find(r => r.cusip === "NEW-AUCTION-2027");
        
        expect(target26?.qty).toBeLessThan(110); // Should be ~100
        expect(target27?.qty).toBeGreaterThan(90); // Should be ~100

        // 2. Verify the specific Trade Recommendations
        const sellTrade = result.trades.find(t => t.cusip === "EXISTING-2026" && t.action === "SELL");
        const buyTrade = result.trades.find(t => t.cusip === "NEW-AUCTION-2027" && t.action === "BUY");

        expect(sellTrade).toBeDefined();
        expect(buyTrade).toBeDefined();

        // The user owns 200, but only needs ~100. Should sell ~100.
        expect(sellTrade?.qty).toBeGreaterThan(90);
        // The user needs ~100 of the new bond.
        expect(buyTrade?.qty).toBeGreaterThan(90);

        // 3. Verify net cost is near zero (since it's a swap of similar valued bonds)
        expect(Math.abs(result.totalNetCost)).toBeLessThan(targetIncome * 0.1);
    });
});
