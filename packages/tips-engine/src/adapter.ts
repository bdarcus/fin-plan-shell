import { calculateRebalance, type BondInfo } from "./core";

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
                maturity: info.maturity,
                coupon: info.coupon,
                price: info.price || 100,
                baseCpi: info.baseCpi,
                yield: info.yield
            });
        }
    }

    const dara = params.dara;
    const startYear = params.startYear || new Date().getFullYear();
    const endYear = params.endYear || (startYear + 30);
    const holdings = params.holdings || [];

    const rebalance = calculateRebalance(bonds, holdings, dara, startYear, endYear);

    // 2. Map new trades back to the weird legacy array format used by the UI
    // Legacy row: [cusip, maturity, price, yield, duration, amount, targetAmount, diff, parAmount (qty), action, actionParAmount (cost?), totalCost, totalValue]
    const legacyResults = rebalance.trades.map(trade => {
        const bond = bonds.find(b => b.cusip === trade.cusip);
        const row = new Array(13).fill(0);
        
        row[0] = trade.cusip;
        row[2] = bond ? bond.maturity : "Unknown";
        row[8] = trade.qty; // Current total qty
        row[9] = trade.action === "BUY" ? trade.qty : (trade.action === "SELL" ? -trade.qty : 0);
        row[11] = trade.estimatedCost;
        
        return row;
    });

    return {
        summary: {
            rungCount: rebalance.targetLadder.length,
            DARA: dara,
            costDeltaSum: rebalance.totalNetCost,
            inferredDARA: dara // Simplified fallback
        },
        results: legacyResults
    };
}
