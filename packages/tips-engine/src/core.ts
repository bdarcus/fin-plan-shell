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

export interface LadderResult {
    rungs: LadderRung[];
    totalCost: number;
    unmetIncome: Record<number, number>; 
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
): LadderResult {
    const sortedBonds = [...bonds].sort((a, b) => new Date(b.maturity).getTime() - new Date(a.maturity).getTime());
    const ladderMap = new Map<string, number>(); 
    
    // Requirements Map: What we still need to fund for each year
    const requirements: Record<number, number> = {};
    for (let y = startYear; y <= endYear; y++) requirements[y] = targetIncome;

    // Process backwards: Starting from the last requirement year
    for (let year = endYear; year >= startYear; year--) {
        const netNeed = requirements[year];
        if (netNeed <= 0.01) continue;

        // Selection: Find the latest available bond that matures ON or BEFORE this year
        const bond = sortedBonds.find(b => {
            const mYear = new Date(b.maturity).getFullYear();
            return mYear <= year && mYear >= startYear;
        });
        
        if (bond) {
            const maturityYear = new Date(bond.maturity).getFullYear();
            
            // To cover 'netNeed' in 'year':
            // If it matures IN 'year', its maturity value (Principal + Half Coupon) funds 'year'.
            // If it matures BEFORE 'year', its principal is held as cash to fund 'year'.
            const factor = (maturityYear === year) ? (1 + (bond.coupon / 2)) : 1.0;
            
            const parNeeded = netNeed / factor;
            const qty = Math.ceil(parNeeded / 100);
            const principal = qty * 100;
            
            ladderMap.set(bond.cusip, (ladderMap.get(bond.cusip) || 0) + qty);
            
            // 1. FUND the target year
            requirements[year] -= (principal * factor);

            // 2. FUND all years PRIOR to maturity via coupons
            for (let y = startYear; y < maturityYear; y++) {
                requirements[y] -= principal * bond.coupon;
            }
            
            // 3. SPECIAL: If this bond matured AT maturityYear, it ALSO pays its final coupon THEN.
            if (maturityYear <= year) {
                // (Already handled by the 'factor' for the target year, but we must be careful 
                // not to double count if maturityYear < year)
                if (maturityYear < year) {
                    requirements[maturityYear] -= (principal * bond.coupon / 2);
                }
            }
        }
    }

    const rungs: LadderRung[] = [];
    for (const [cusip, qty] of ladderMap.entries()) {
        const bond = bonds.find(b => b.cusip === cusip)!;
        const principal = qty * 100;
        const cost = qty * bond.price;

        rungs.push({
            year: new Date(bond.maturity).getFullYear(),
            cusip,
            qty,
            cost,
            principal,
            couponIncome: principal * bond.coupon
        });
    }

    const sortedRungs = rungs.sort((a, b) => a.year - b.year);
    return {
        rungs: sortedRungs,
        totalCost: sortedRungs.reduce((acc, r) => acc + r.cost, 0),
        unmetIncome: {}
    };
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
    const ladderResult = buildLadder(bonds, targetIncome, startYear, endYear);
    const targetLadder = ladderResult.rungs;
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
        trades: trades.sort((a, b) => a.action.localeCompare(b.action)), 
        totalNetCost
    };
}
