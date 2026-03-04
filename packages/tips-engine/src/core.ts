/**
 * Pure headless math engine for TIPS ladder generation.
 * Implements the Pfau/DARA (Desired Annual Real Amount) method.
 */

export interface BondInfo {
    cusip: string;
    maturity: string; // YYYY-MM-DD
    coupon: number; // e.g. 0.015 for 1.5%
    price: number; // clean price per $100 par
    baseCpi: number;
    yield?: number;
}

export interface LadderRung {
    year: number;
    cusip: string;
    qty: number;
    cost: number;
    principal: number; // face value in that year
    couponIncome: number; // total coupon income across the ladder from this bond
}

export interface LadderResult {
    rungs: LadderRung[];
    totalCost: number;
    unmetIncome: Record<number, number>; // If a gap couldn't be filled perfectly
}

/**
 * Builds a TIPS ladder matching duration/cashflows backwards.
 */
export function buildLadder(
    bonds: BondInfo[],
    targetIncome: number,
    startYear: number,
    endYear: number,
    currentDate: Date = new Date()
): LadderResult {
    // Sort bonds by maturity (descending)
    const sortedBonds = [...bonds].sort((a, b) => new Date(b.maturity).getTime() - new Date(a.maturity).getTime());
    
    const rungs: LadderRung[] = [];
    const couponDripMap: Record<number, number> = {};
    let totalCost = 0;
    const unmetIncome: Record<number, number> = {};

    // Initialize drip map
    for (let y = startYear; y <= endYear; y++) {
        couponDripMap[y] = 0;
    }

    // Work backwards from endYear down to startYear
    for (let year = endYear; year >= startYear; year--) {
        const need = targetIncome - couponDripMap[year];
        
        if (need <= 0) continue; // Covered entirely by coupons from longer bonds

        // Find best bond for this year (usually early year maturity like Feb or April)
        // For simplicity, just pick the first bond maturing in this year
        const bond = sortedBonds.find(b => new Date(b.maturity).getFullYear() === year);

        if (!bond) {
            // Gap year! 
            // In a full implementation, we'd use Synthetic bonds and Duration Matching.
            // For now, record as unmet.
            unmetIncome[year] = need;
            continue;
        }

        // TIPS pay semi-annually. In the year of maturity, you get Principal + half year coupon.
        // E.g., for $1000 par, you get 1000 + (1000 * coupon / 2)
        // We need 'need' dollars.
        // Let Q = par amount needed.
        // Q + Q * (coupon/2) = need
        // Q * (1 + coupon/2) = need
        // Q = need / (1 + coupon/2)
        
        // Since bonds are bought in increments of $100 par usually, we calculate raw par.
        const parNeeded = need / (1 + (bond.coupon / 2));
        
        // Let's round to nearest $100 for realism, but exact math for theoretical:
        const qtyRaw = parNeeded / 100;
        const qty = Math.ceil(qtyRaw); // Buy whole bonds (e.g. 15 = $1500 par)
        const principal = qty * 100;

        // Calculate cost based on clean price (price is per $100 par)
        // Note: Real cost includes accrued interest and index ratio, but for projection we use clean price or approximate.
        const cost = qty * bond.price;
        totalCost += cost;

        // Add this bond's future coupons to the drip map for all years BEFORE this year
        const annualCouponIncome = principal * bond.coupon;
        
        // Let's say bond matures in YYYY. It pays coupons every year from now until YYYY.
        const startY = Math.max(startYear, currentDate.getFullYear());
        for (let y = startY; y < year; y++) {
            couponDripMap[y] += annualCouponIncome;
        }

        rungs.push({
            year,
            cusip: bond.cusip,
            qty,
            cost,
            principal,
            couponIncome: annualCouponIncome
        });
    }

    return {
        // Reverse so it's chronological
        rungs: rungs.sort((a, b) => a.year - b.year),
        totalCost,
        unmetIncome
    };
}
