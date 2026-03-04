/**
 * Pure headless math engine for TIPS ladder generation and rebalancing.
 * Implements the Pfau/DARA (Desired Annual Real Amount) method.
 */

export interface BondInfo {
    cusip: string;
    maturity: string; // YYYY-MM-DD
    coupon: number; 
    price: number; 
    baseCpi: number;
    yield?: number;
}

export interface Holding {
    cusip: string;
    qty: number;
}

export interface Trade {
    cusip: string;
    action: "BUY" | "SELL" | "HOLD";
    qty: number; // Absolute quantity to trade
    estimatedPrice: number;
    estimatedCost: number; // Negative for proceeds from SELL
}

export interface LadderRung {
    year: number; 
    cusip: string;
    qty: number;
    cost: number;
    principal: number;
    couponIncome: number;
}

export interface RebalanceResult {
    targetLadder: LadderRung[];
    trades: Trade[];
    totalNetCost: number; // Total cash required (positive) or proceeds (negative)
}

/**
 * Builds the ideal target ladder.
 */
export function buildLadder(
    bonds: BondInfo[],
    targetIncome: number,
    startYear: number,
    endYear: number,
    _currentDate: Date = new Date()
): LadderRung[] {
    const sortedBonds = [...bonds].sort((a, b) => new Date(b.maturity).getTime() - new Date(a.maturity).getTime());
    const ladderMap = new Map<string, number>(); 
    
    const requirements: Record<number, number> = {};
    for (let y = startYear; y <= endYear; y++) requirements[y] = targetIncome;

    for (let year = endYear; year >= startYear; year--) {
        const netNeed = requirements[year];
        if (netNeed <= 0.01) continue;

        const bond = sortedBonds.find(b => {
            const mYear = new Date(b.maturity).getFullYear();
            return mYear <= year && mYear >= startYear;
        });
        
        if (bond) {
            const maturityYear = new Date(bond.maturity).getFullYear();
            const factor = (maturityYear === year) ? (1 + (bond.coupon / 2)) : 1.0;
            
            const parNeeded = netNeed / factor;
            const qty = Math.ceil(parNeeded / 100);
            const principal = qty * 100;
            
            ladderMap.set(bond.cusip, (ladderMap.get(bond.cusip) || 0) + qty);
            
            for (let y = maturityYear; y <= year; y++) {
                const coverage = (y === maturityYear) ? principal * (1 + (bond.coupon / 2)) : principal;
                requirements[y] -= coverage;
            }

            for (let y = startYear; y < maturityYear; y++) {
                requirements[y] -= principal * bond.coupon;
            }
        }
    }

    const rungs: LadderRung[] = [];
    for (const [cusip, qty] of ladderMap.entries()) {
        const bond = bonds.find(b => b.cusip === cusip)!;
        const principal = qty * 100;
        rungs.push({
            year: new Date(bond.maturity).getFullYear(),
            cusip,
            qty,
            cost: qty * bond.price,
            principal,
            couponIncome: principal * bond.coupon
        });
    }
    return rungs.sort((a, b) => a.year - b.year);
}

/**
 * Calculates the trades necessary to reach the target ladder from current holdings.
 */
export function calculateRebalance(
    bonds: BondInfo[],
    currentHoldings: Holding[],
    targetIncome: number,
    startYear: number,
    endYear: number
): RebalanceResult {
    const targetLadder = buildLadder(bonds, targetIncome, startYear, endYear);
    const trades: Trade[] = [];
    let totalNetCost = 0;

    // 1. Identify BUYS and HOLDS
    for (const target of targetLadder) {
        const current = currentHoldings.find(h => h.cusip === target.cusip);
        const currentQty = current ? current.qty : 0;
        const diff = target.qty - currentQty;

        if (diff > 0) {
            const bond = bonds.find(b => b.cusip === target.cusip)!;
            const cost = diff * bond.price;
            trades.push({
                cusip: target.cusip,
                action: "BUY",
                qty: diff,
                estimatedPrice: bond.price,
                estimatedCost: cost
            });
            totalNetCost += cost;
        } else if (diff === 0) {
            const bond = bonds.find(b => b.cusip === target.cusip)!;
            trades.push({
                cusip: target.cusip,
                action: "HOLD",
                qty: target.qty,
                estimatedPrice: bond.price,
                estimatedCost: 0
            });
        }
    }

    // 2. Identify SELLS (current holdings not in target or over-target)
    for (const holding of currentHoldings) {
        const target = targetLadder.find(t => t.cusip === holding.cusip);
        const targetQty = target ? target.qty : 0;
        const diff = holding.qty - targetQty;

        if (diff > 0) {
            // We own more than we need (or it's no longer in the ideal ladder)
            // Use the market price if available, fallback to par
            const bond = bonds.find(b => b.cusip === holding.cusip);
            const price = bond ? bond.price : 100;
            const proceeds = diff * price;
            
            trades.push({
                cusip: holding.cusip,
                action: "SELL",
                qty: diff,
                estimatedPrice: price,
                estimatedCost: -proceeds
            });
            totalNetCost -= proceeds;
        }
    }

    return {
        targetLadder,
        trades: trades.sort((a, b) => a.action.localeCompare(b.action)), // Group by Buy/Sell/Hold
        totalNetCost
    };
}
