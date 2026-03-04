import { buildLadder, type BondInfo } from "./core";

/**
 * An adapter to bridge the new clean-room core engine with the legacy UI expectations.
 */
export function runRebalanceLegacyAdapter(params: any): any {
    // 1. Convert legacy TipsMap into BondInfo array
    const bonds: BondInfo[] = [];
    if (params.tipsMap) {
        for (const [cusip, info] of params.tipsMap.entries()) {
            bonds.push({
                cusip: cusip,
                maturity: info.maturity, // assuming string
                coupon: info.coupon,
                price: info.price || 100, // fallback if missing
                baseCpi: info.baseCpi,
                yield: info.yield
            });
        }
    }

    const dara = params.dara;
    const startYear = params.startYear;
    const endYear = params.endYear;

    const result = buildLadder(bonds, dara, startYear, endYear, params.settlementDate || new Date());

    // 2. Map new rungs back to the weird legacy array format
    // [cusip, maturity, price, yield, duration, amount, targetAmount, diff, parAmount (qty), action, actionParAmount (cost?), totalCost, totalValue]
    const legacyResults = result.rungs.map(rung => {
        const bond = bonds.find(b => b.cusip === rung.cusip);
        const row = new Array(13).fill(0);
        row[0] = rung.cusip;
        row[2] = bond ? bond.maturity : `${rung.year}-04-15`;
        row[3] = rung.year;
        row[8] = rung.qty;
        row[10] = rung.cost;
        return row;
    });

    return {
        summary: {
            rungCount: result.rungs.length,
            DARA: dara,
            costDeltaSum: result.totalCost
        },
        results: legacyResults
    };
}
