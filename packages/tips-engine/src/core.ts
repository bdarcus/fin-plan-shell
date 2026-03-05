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

export type LadderModelFidelity = "exact-cashflow" | "annual-approx";

export interface BuildLadderOptions {
	settlementDate?: Date;
	modelFidelity?: LadderModelFidelity;
	strictUnmetLiability?: boolean;
	allowOutOfHorizonMaturities?: boolean;
	maturityDeflationFloor?: boolean;
}

export interface RebalanceOptions extends BuildLadderOptions {
	unknownHoldingCusipPolicy?: "error" | "conservative-price";
}

const MIN_NEED_THRESHOLD = 0.01;

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

function addMonths(date: Date, months: number): Date {
	return new Date(
		date.getFullYear(),
		date.getMonth() + months,
		date.getDate(),
		date.getHours(),
		date.getMinutes(),
		date.getSeconds(),
		date.getMilliseconds(),
	);
}

function startOfDay(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function normalizeBuildOptions(
	optionsOrCurrentDate?: BuildLadderOptions | Date,
): Required<BuildLadderOptions> {
	if (optionsOrCurrentDate instanceof Date) {
		return {
			settlementDate: optionsOrCurrentDate,
			modelFidelity: "exact-cashflow",
			strictUnmetLiability: false,
			allowOutOfHorizonMaturities: false,
			maturityDeflationFloor: true,
		};
	}
	return {
		settlementDate: optionsOrCurrentDate?.settlementDate ?? new Date(),
		modelFidelity: optionsOrCurrentDate?.modelFidelity ?? "exact-cashflow",
		strictUnmetLiability: optionsOrCurrentDate?.strictUnmetLiability ?? false,
		allowOutOfHorizonMaturities:
			optionsOrCurrentDate?.allowOutOfHorizonMaturities ?? false,
		maturityDeflationFloor:
			optionsOrCurrentDate?.maturityDeflationFloor ?? true,
	};
}

function getMaturityYear(bond: BondInfo): number {
	return parseLocalDate(bond.maturity).getFullYear();
}

function getBondCostPerUnit(bond: BondInfo): number {
	return bond.price * bond.indexRatio;
}

function clamp(n: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, n));
}

function getExactCashflowPerHundred(
	bond: BondInfo,
	year: number,
	settlementDate: Date,
): number {
	const maturity = parseLocalDate(bond.maturity);
	const maturityYear = maturity.getFullYear();
	if (year > maturityYear) return 0;

	const payoutCoupon = 100 * (bond.coupon / 2);
	const settlement = startOfDay(settlementDate);
	const maturityCouponDate = new Date(
		year,
		maturity.getMonth(),
		maturity.getDate(),
	);
	const otherCouponDate = addMonths(maturityCouponDate, -6);
	const couponDates = [maturityCouponDate, otherCouponDate].sort(
		(a, b) => a.getTime() - b.getTime(),
	);

	let cashflow = 0;
	for (const couponDate of couponDates) {
		if (
			couponDate.getFullYear() === year &&
			couponDate > settlement &&
			couponDate <= maturity
		) {
			cashflow += payoutCoupon;
		}
	}

	if (year === maturityYear && maturity > settlement) {
		// In a real-dollar model, principal floor is par 100.
		cashflow += 100;
	}
	return cashflow;
}

function getApproxCashflowPerHundred(bond: BondInfo, year: number): number {
	const maturityYear = getMaturityYear(bond);
	if (year > maturityYear) return 0;
	if (year === maturityYear) return 100 * (1 + bond.coupon / 2);
	return 100 * bond.coupon;
}

function getCashflowPerHundred(
	bond: BondInfo,
	year: number,
	options: Required<BuildLadderOptions>,
): number {
	if (options.modelFidelity === "annual-approx") {
		return getApproxCashflowPerHundred(bond, year);
	}
	return getExactCashflowPerHundred(bond, year, options.settlementDate);
}

function applyCoverageFromBond(
	requirements: Record<number, number>,
	bond: BondInfo,
	qty: number,
	startYear: number,
	endYear: number,
	options: Required<BuildLadderOptions>,
) {
	for (let y = startYear; y <= endYear; y++) {
		requirements[y] -= qty * getCashflowPerHundred(bond, y, options);
	}
}

function getBestExactMaturityBond(
	candidates: BondInfo[],
	year: number,
	options: Required<BuildLadderOptions>,
): BondInfo | undefined {
	const viable = candidates
		.map((bond) => {
			const targetCf = getCashflowPerHundred(bond, year, options);
			if (targetCf <= MIN_NEED_THRESHOLD) return null;
			return {
				bond,
				efficiency: getBondCostPerUnit(bond) / targetCf,
			};
		})
		.filter(
			(item): item is { bond: BondInfo; efficiency: number } => item !== null,
		)
		.sort((a, b) => a.efficiency - b.efficiency);
	return viable[0]?.bond;
}

function interpolateDurationWeights(
	lowerBond: BondInfo,
	upperBond: BondInfo,
	targetYear: number,
	currentYear: number,
): { lower: number; upper: number } {
	const y1 = getMaturityYear(lowerBond);
	const y2 = getMaturityYear(upperBond);
	if (y2 <= y1) return { lower: 0.5, upper: 0.5 };

	const yieldInterpolated =
		lowerBond.yield +
		(upperBond.yield - lowerBond.yield) * ((targetYear - y1) / (y2 - y1));
	const dTarget = calculateMacaulayDuration(
		targetYear - currentYear,
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
	if (
		!Number.isFinite(dTarget) ||
		!Number.isFinite(d1) ||
		!Number.isFinite(d2)
	) {
		return { lower: 0.5, upper: 0.5 };
	}

	const spread = d2 - d1;
	if (Math.abs(spread) < 1e-9) return { lower: 0.5, upper: 0.5 };

	const upper = clamp((dTarget - d1) / spread, 0, 1);
	return { lower: 1 - upper, upper };
}

/**
 * Builds the ideal target ladder using Duration Matching for gaps.
 */
export function buildLadder(
	bonds: BondInfo[],
	targetIncome: number,
	startYear: number,
	endYear: number,
	optionsOrCurrentDate?: BuildLadderOptions | Date,
): LadderResult {
	const options = normalizeBuildOptions(optionsOrCurrentDate);
	const currentYear = options.settlementDate.getFullYear();
	const sortedBonds = [...bonds].sort((a, b) => {
		const yearCmp = getMaturityYear(a) - getMaturityYear(b);
		if (yearCmp !== 0) return yearCmp;
		return a.cusip.localeCompare(b.cusip);
	});
	const ladderMap = new Map<string, number>();
	const eligibleBonds = sortedBonds.filter((b) => {
		const year = getMaturityYear(b);
		if (year < startYear) return false;
		if (options.allowOutOfHorizonMaturities) return true;
		return year <= endYear;
	});

	// Requirements Map: What we still need to fund for each year
	const requirements: Record<number, number> = {};
	for (let y = startYear; y <= endYear; y++) requirements[y] = targetIncome;

	// Process backwards: Starting from the last requirement year
	for (let year = endYear; year >= startYear; year--) {
		const netNeed = requirements[year];
		if (netNeed <= MIN_NEED_THRESHOLD) continue;

		// 1. Try to find an exact maturity
		const exactBond = getBestExactMaturityBond(
			eligibleBonds.filter((b) => getMaturityYear(b) === year),
			year,
			options,
		);

		if (exactBond) {
			const coveragePerUnit = getCashflowPerHundred(exactBond, year, options);
			if (coveragePerUnit <= MIN_NEED_THRESHOLD) continue;
			const qty = Math.ceil(netNeed / coveragePerUnit);
			if (qty <= 0) continue;

			ladderMap.set(
				exactBond.cusip,
				(ladderMap.get(exactBond.cusip) || 0) + qty,
			);
			applyCoverageFromBond(
				requirements,
				exactBond,
				qty,
				startYear,
				endYear,
				options,
			);
		} else {
			// 2. GAP HANDLING: Duration Matching with Synthetic Rung
			const lowerBond = [...eligibleBonds]
				.filter((b) => getMaturityYear(b) < year)
				.sort((a, b) => getMaturityYear(b) - getMaturityYear(a))[0];
			const upperBond = [...eligibleBonds]
				.filter((b) => getMaturityYear(b) > year)
				.sort((a, b) => getMaturityYear(a) - getMaturityYear(b))[0];

			if (lowerBond && upperBond) {
				const weights = interpolateDurationWeights(
					lowerBond,
					upperBond,
					year,
					currentYear,
				);
				// Allocate 'netNeed' across these two real bonds
				[
					{ b: lowerBond, w: weights.lower },
					{ b: upperBond, w: weights.upper },
				].forEach((pair) => {
					if (pair.w <= MIN_NEED_THRESHOLD) return;
					const allocatedPrincipal = netNeed * pair.w;
					const coveragePerUnit = Math.max(
						getCashflowPerHundred(pair.b, year, options),
						100,
					);
					const qty = Math.ceil(allocatedPrincipal / coveragePerUnit);
					if (qty <= 0) return;

					ladderMap.set(pair.b.cusip, (ladderMap.get(pair.b.cusip) || 0) + qty);
					applyCoverageFromBond(
						requirements,
						pair.b,
						qty,
						startYear,
						endYear,
						options,
					);
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
			cost: qty * getBondCostPerUnit(bond),
			principal,
			couponIncome: principal * bond.coupon,
		});
	}

	const sortedRungs = rungs.sort((a, b) => a.year - b.year);
	const unmetIncome: Record<number, number> = {};
	for (let year = startYear; year <= endYear; year++) {
		if (requirements[year] > MIN_NEED_THRESHOLD) {
			unmetIncome[year] = requirements[year];
		}
	}
	if (options.strictUnmetLiability && Object.keys(unmetIncome).length > 0) {
		throw new Error(
			`Unmet income requirements for years: ${Object.keys(unmetIncome).join(", ")}`,
		);
	}

	return {
		rungs: sortedRungs,
		totalCost: sortedRungs.reduce((acc, r) => acc + r.cost, 0),
		unmetIncome,
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
	options: RebalanceOptions = {},
): RebalanceResult {
	const ladderResult = buildLadder(
		bonds,
		targetIncome,
		startYear,
		endYear,
		options,
	);
	const targetLadder = ladderResult.rungs;
	const trades: Trade[] = [];
	let totalNetCost = 0;
	const unknownHoldingPolicy =
		options.unknownHoldingCusipPolicy ?? "conservative-price";
	const bondByCusip = new Map(bonds.map((bond) => [bond.cusip, bond]));
	const actionOrder: Record<Trade["action"], number> = {
		BUY: 0,
		HOLD: 1,
		SELL: 2,
	};

	for (const target of targetLadder) {
		const current = currentHoldings.find((h) => h.cusip === target.cusip);
		const currentQty = current ? current.qty : 0;
		const diff = target.qty - currentQty;

		if (diff > 0) {
			const bond = bondByCusip.get(target.cusip);
			if (!bond) continue;
			const unitPrice = getBondCostPerUnit(bond);
			const cost = diff * unitPrice;
			trades.push({
				cusip: target.cusip,
				action: "BUY",
				qty: diff,
				estimatedPrice: unitPrice,
				estimatedCost: cost,
			});
			totalNetCost += cost;
		} else if (diff === 0) {
			const bond = bondByCusip.get(target.cusip);
			if (!bond) continue;
			trades.push({
				cusip: target.cusip,
				action: "HOLD",
				qty: target.qty,
				estimatedPrice: getBondCostPerUnit(bond),
				estimatedCost: 0,
			});
		}
	}

	for (const holding of currentHoldings) {
		const target = targetLadder.find((t) => t.cusip === holding.cusip);
		const targetQty = target ? target.qty : 0;
		const diff = holding.qty - targetQty;

		if (diff > 0) {
			const bond = bondByCusip.get(holding.cusip);
			if (!bond && unknownHoldingPolicy === "error") {
				throw new Error(`Unknown holding CUSIP: ${holding.cusip}`);
			}
			const price = bond ? getBondCostPerUnit(bond) : 100;
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
		trades: trades.sort((a, b) => {
			const aBond = bondByCusip.get(a.cusip);
			const bBond = bondByCusip.get(b.cusip);
			const aYear = aBond ? getMaturityYear(aBond) : Number.MAX_SAFE_INTEGER;
			const bYear = bBond ? getMaturityYear(bBond) : Number.MAX_SAFE_INTEGER;
			if (aYear !== bYear) return aYear - bYear;
			const cusipCmp = a.cusip.localeCompare(b.cusip);
			if (cusipCmp !== 0) return cusipCmp;
			return actionOrder[a.action] - actionOrder[b.action];
		}),
		totalNetCost,
	};
}
