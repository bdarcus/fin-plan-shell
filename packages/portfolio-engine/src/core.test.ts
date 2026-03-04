import { expect, test, describe } from "bun:test";
import { calculateConstantAmortization, projectPortfolio } from "./core";

describe("Portfolio Engine", () => {
    test("Amortization matches 4% rule math", () => {
        const balance = 1000000;
        const rate = 0.04;
        const horizon = 30;
        
        const income = calculateConstantAmortization(balance, rate, horizon);
        
        // At 4% rate and 30 years, constant real spending should be ~$57.8k
        expect(income).toBeCloseTo(57830, -1);
        
        // After 30 years of this spending at 4% return, balance should be 0
        const projection = projectPortfolio(balance, rate, horizon, income);
        expect(projection[projection.length - 1]).toBeCloseTo(0, 0);
    });

    test("Handles bequest correctly", () => {
        const balance = 1000000;
        const rate = 0.05;
        const horizon = 20;
        const bequest = 500000;
        
        const income = calculateConstantAmortization(balance, rate, horizon, bequest);
        const projection = projectPortfolio(balance, rate, horizon, income);
        
        // Final balance should equal bequest
        expect(projection[projection.length - 1]).toBeCloseTo(bequest, 0);
    });
});
