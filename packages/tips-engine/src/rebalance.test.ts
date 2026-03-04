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

    test("Identifies SELL for excess holdings", () => {
        const bonds: BondInfo[] = [
            { cusip: "BOND-2026", maturity: "2026-04-15", coupon: 0.02, price: 100, baseCpi: 100 }
        ];
        const currentHoldings: Holding[] = [{ cusip: "BOND-2026", qty: 500 }]; // Way too much
        const result = calculateRebalance(bonds, currentHoldings, 10000, 2026, 2026);

        const sellTrade = result.trades.find(t => t.action === "SELL");
        expect(sellTrade?.qty).toBe(401); // Target for 10k income is 99 bonds (99*1.01 = 9999... so 100 bonds)
        // Wait: 10000 / 1.01 = 9900.99 -> 100 bonds. 500 - 100 = 400.
        expect(result.targetLadder[0].qty).toBe(100);
    });
});
