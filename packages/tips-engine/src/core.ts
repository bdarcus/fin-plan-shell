/**
 * Pure headless math engine for TIPS ladder generation and rebalancing.
 * Implements the Pfau/DARA (Desired Annual Real Amount) method with Duration Matching.
 */

export interface BondInfo {
	cusip: string;
	maturity: string; // YYYY-MM-DD
	coupon: number;
	price: number;
	baseCpi: number;
	indexRatio: number; // Current CPI / Base CPI
	yield: number; // Real yield
}

export interface Holding {
	cusip: string;
	qty: number;
}

export interface Trade {
	cusip: string;
	action: "BUY" | "SELL" | "HOLD";
	qty: number;
	estimatedPrice: number;
	estimatedCost: number;
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
	totalNetCost: number;
}

/**
 * Calculates Macaulay Duration for a TIPS bond.
 */
function calculateMacaulayDuration(
	years: number,
	coupon: number,
	realYield: number,
): number {
	if (years <= 0) return 0;
	const y = realYield / 2; // Semi-annual yield
	const c = coupon / 2; // Semi-annual coupon
	const n = Math.max(1, Math.round(years * 2)); // Periods

	let weightedCashflows = 0;
	let price = 0;

	for (let i = 1; i <= n; i++) {
		const time = i / 2;
		const cf = i === n ? 100 + c * 100 : c * 100;
		const pv = cf / (1 + y) ** i;
		price += pv;
		weightedCashflows += time * pv;
	}

	return weightedCashflows / price;
}

/**
 * Parses YYYY-MM-DD as a local date (preventing UTC shift).
 */
function parseLocalDate(str: string): Date {
	const [y, m, d] = str.split("-").map(Number);
	return new Date(y, m - 1, d);
}

/**
 * Builds the ideal target ladder using Duration Matching for gaps.
 */
export function buildLadder(
	bonds: BondInfo[],
	targetIncome: number,
	startYear: number,
	endYear: number,
	_currentDate: Date = new Date(),
): LadderResult {
	const sortedBonds = [...bonds].sort(
		(a, b) =>
			parseLocalDate(b.maturity).getTime() -
			parseLocalDate(a.maturity).getTime(),
	);
	const ladderMap = new Map<string, number>();
	const currentYear = _currentDate.getFullYear();

	// Requirements Map: What we still need to fund for each year
	const requirements: Record<number, number> = {};
	for (let y = startYear; y <= endYear; y++) requirements[y] = targetIncome;

	// Process backwards: Starting from the last requirement year
	for (let year = endYear; year >= startYear; year--) {
		const netNeed = requirements[year];
		if (netNeed <= 0.01) continue;

		// 1. Try to find an exact maturity
		const exactBond = sortedBonds.find(
			(b) => parseLocalDate(b.maturity).getFullYear() === year,
		);

		if (exactBond) {
			const parNeeded = netNeed / (1 + exactBond.coupon / 2);
			const qty = Math.ceil(parNeeded / 100);
			const principal = qty * 100;

			ladderMap.set(
				exactBond.cusip,
				(ladderMap.get(exactBond.cusip) || 0) + qty,
			);

			// FUND the target year
			requirements[year] -= principal * (1 + exactBond.coupon / 2);
			// FUND all years PRIOR to maturity via coupons
			for (let y = startYear; y < year; y++) {
				requirements[y] -= principal * exactBond.coupon;
			}
		} else {
			// 2. GAP HANDLING: Duration Matching with Synthetic Rung
			const lowerBond = sortedBonds.find(
				(b) =>
					parseLocalDate(b.maturity).getFullYear() < year &&
					parseLocalDate(b.maturity).getFullYear() >= startYear,
			);
			const upperBond = sortedBonds.find(
				(b) => parseLocalDate(b.maturity).getFullYear() > year,
			);

			if (lowerBond && upperBond) {
				const y1 = parseLocalDate(lowerBond.maturity).getFullYear();
				const y2 = parseLocalDate(upperBond.maturity).getFullYear();

				// Interpolate Yield for the synthetic year
				const yieldInterpolated =
					lowerBond.yield +
					(upperBond.yield - lowerBond.yield) * ((year - y1) / (y2 - y1));

				// Calculate Durations
				const dTarget = calculateMacaulayDuration(
					year - currentYear,
					0.0125,
					yieldInterpolated,
				);
				const d1 = calculateMacaulayDuration(
					y1 - currentYear,
					lowerBond.coupon,
					lowerBond.yield,
				);
				const d2 = calculateMacaulayDuration(
					y2 - currentYear,
					upperBond.coupon,
					upperBond.yield,
				);

				// Solve for weights: w1*d1 + w2*d2 = dTarget, w1 + w2 = 1
				// Solving for w2: w2 = (dTarget - d1) / (d2 - d1)
				const w2 = (dTarget - d1) / (d2 - d1);
				const w1 = 1 - w2;

				// Allocate 'netNeed' across these two real bonds
				[
					{ b: lowerBond, w: w1 },
					{ b: upperBond, w: w2 },
				].forEach((pair) => {
					const allocatedPrincipal = netNeed * pair.w;
					const parNeeded = allocatedPrincipal / (1 + pair.b.coupon / 2);
					const qty = Math.ceil(parNeeded / 100);
					const principal = qty * 100;

					ladderMap.set(pair.b.cusip, (ladderMap.get(pair.b.cusip) || 0) + qty);

					const mYear = parseLocalDate(pair.b.maturity).getFullYear();

					// Subtract from requirements
					// 1. Coverage of the target 'year'
					requirements[year] -= principal * pair.w; // Linear coverage

					// 2. Coverage of maturity year (if lower bond)
					if (mYear === year) {
						requirements[mYear] -= principal * (1 + pair.b.coupon / 2);
					} else if (mYear < year) {
						// Principal available for gap years
						for (let y = mYear; y < year; y++) {
							const coverage =
								y === mYear ? principal * (1 + pair.b.coupon / 2) : principal;
							requirements[y] -= coverage;
						}
					}

					// 3. Coupons
					for (let y = startYear; y < mYear; y++) {
						requirements[y] -= principal * pair.b.coupon;
					}
				});
			}
		}
	}

	const rungs: LadderRung[] = [];
	for (const [cusip, qty] of ladderMap.entries()) {
		const bond = bonds.find((b) => b.cusip === cusip);
		if (!bond) continue;
		const principal = qty * 100;
		rungs.push({
			year: parseLocalDate(bond.maturity).getFullYear(),
			cusip,
			qty,
			// Actual cost = qty * Price * IndexRatio
			cost: qty * (bond.price * bond.indexRatio),
			principal,
			couponIncome: principal * bond.coupon,
		});
	}

	const sortedRungs = rungs.sort((a, b) => a.year - b.year);
	return {
		rungs: sortedRungs,
		totalCost: sortedRungs.reduce((acc, r) => acc + r.cost, 0),
		unmetIncome: {},
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
	endYear: number,
): RebalanceResult {
	const ladderResult = buildLadder(bonds, targetIncome, startYear, endYear);
	const targetLadder = ladderResult.rungs;
	const trades: Trade[] = [];
	let totalNetCost = 0;

	for (const target of targetLadder) {
		const current = currentHoldings.find((h) => h.cusip === target.cusip);
		const currentQty = current ? current.qty : 0;
		const diff = target.qty - currentQty;

		if (diff > 0) {
			const bond = bonds.find((b) => b.cusip === target.cusip);
			if (!bond) continue;
			const cost = diff * (bond.price * bond.indexRatio);
			trades.push({
				cusip: target.cusip,
				action: "BUY",
				qty: diff,
				estimatedPrice: bond.price * bond.indexRatio,
				estimatedCost: cost,
			});
			totalNetCost += cost;
		} else if (diff === 0) {
			const bond = bonds.find((b) => b.cusip === target.cusip);
			if (!bond) continue;
			trades.push({
				cusip: target.cusip,
				action: "HOLD",
				qty: target.qty,
				estimatedPrice: bond.price * bond.indexRatio,
				estimatedCost: 0,
			});
		}
	}

	for (const holding of currentHoldings) {
		const target = targetLadder.find((t) => t.cusip === holding.cusip);
		const targetQty = target ? target.qty : 0;
		const diff = holding.qty - targetQty;

		if (diff > 0) {
			const bond = bonds.find((b) => b.cusip === holding.cusip);
			const price = bond ? bond.price * bond.indexRatio : 100;
			const proceeds = diff * price;
			trades.push({
				cusip: holding.cusip,
				action: "SELL",
				qty: diff,
				estimatedPrice: price,
				estimatedCost: -proceeds,
			});
			totalNetCost -= proceeds;
		}
	}

	return {
		targetLadder,
		trades: trades.sort((a, b) => a.action.localeCompare(b.action)),
		totalNetCost,
	};
}
