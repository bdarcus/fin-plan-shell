/**
 * Pure headless math engine for TIPS ladder generation and rebalancing.
 * Implements the Pfau/DARA (Desired Annual Real Amount) method with Duration Matching.
 *
 * Portions of the financial logic (synthetic coupon interpolation and pre-ladder
 * interest pool) are inspired by or adapted from
 * https://github.com/aerokam/TipsLadderBuilder (MIT License).
 * Copyright (c) 2026 aerokam
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

export type GapBracketRole = "lower" | "upper";
export type TradeIntent = "exact-match" | "gap-bridge" | "maintenance";

export interface Trade {
	positionId: string;
	cusip: string;
	action: "BUY" | "SELL" | "HOLD";
	qty: number;
	currentQty: number;
	targetQty: number;
	estimatedPrice: number;
	estimatedCost: number;
	intent?: TradeIntent;
	gapYear?: number;
	targetYear?: number;
	bracketRole?: GapBracketRole;
}

export interface LadderRung {
	year: number;
	cusip: string;
	qty: number;
	cost: number;
	principal: number;
	couponIncome: number;
	coverageType?: "exact" | "gap";
	gapYear?: number;
	targetYear?: number;
	bracketRole?: GapBracketRole;
	positionId?: string;
}

export interface TargetPosition {
	positionId: string;
	cusip: string;
	maturity: string;
	year: number;
	qty: number;
	cost: number;
	principal: number;
	couponIncome: number;
	coverageType: "exact" | "gap";
	targetYear: number;
	bracketRole?: GapBracketRole;
}

export interface LadderResult {
	rungs: LadderRung[];
	totalCost: number;
	unmetIncome: Record<number, number>;
	positions: TargetPosition[];
}

export interface RebalanceUpgradeGroup {
	targetYear: number;
	buy: Trade;
	sells: Trade[];
	netCost: number;
}

export interface RebalanceResult {
	targetLadder: LadderRung[];
	targetPositions: TargetPosition[];
	currentPositions: TargetPosition[];
	trades: Trade[];
	totalNetCost: number;
	unmetIncome: Record<number, number>;
	holdingsAfter: Holding[];
	upgradeGroups: RebalanceUpgradeGroup[];
}

interface LadderAllocation {
	positionId: string;
	cusip: string;
	qty: number;
	coverageType: "exact" | "gap";
	targetYear: number;
	bracketRole?: GapBracketRole;
}

interface GapPair {
	lowerBond: BondInfo;
	upperBond: BondInfo;
	weights: { lower: number; upper: number };
	blendedCostPerUnit: number;
}

export type LadderModelFidelity = "exact-cashflow" | "annual-approx";
export type GapUpperSelectionStrategy = "nearest" | "cheapest";

export interface BuildLadderOptions {
	settlementDate?: Date;
	modelFidelity?: LadderModelFidelity;
	strictUnmetLiability?: boolean;
	allowOutOfHorizonMaturities?: boolean;
	maturityDeflationFloor?: boolean;
	gapUpperSelectionStrategy?: GapUpperSelectionStrategy;
	usePreLadderInterest?: boolean;
	indexRatio?: number;
	currentHoldings?: Holding[];
	holdingPreferenceWeight?: number;
}

export interface RebalanceOptions extends BuildLadderOptions {
	unknownHoldingCusipPolicy?: "error" | "conservative-price";
	minTradeQtyThreshold?: number;
	minTradeCostThreshold?: number;
	currentTargetPositions?: TargetPosition[];
}

const MIN_NEED_THRESHOLD = 0.01;
const SYNTHETIC_GAP_LIQUIDATION_PER_HUNDRED = 100;
const MAX_CHEAPEST_CUSIP_COST_SHARE = 0.35;
const MIN_CHEAPEST_WIDENING_IMPROVEMENT = 0.05;

function syntheticCoupon(yld: number): number {
	return Math.max(0.00125, Math.floor((yld * 100) / 0.125) * 0.00125);
}

function getNumPeriods(settlement: Date, maturity: Date): number {
	const months =
		(maturity.getFullYear() - settlement.getFullYear()) * 12 +
		(maturity.getMonth() - settlement.getMonth());
	return Math.ceil(months / 6);
}

function calculateModifiedDuration(
	settlement: Date,
	maturity: Date,
	coupon: number,
	realYield: number,
): number {
	if (maturity <= settlement) return 0;
	const y = realYield / 2;
	const c = coupon / 2;
	const n = Math.max(1, getNumPeriods(settlement, maturity));

	let weightedCashflows = 0;
	let price = 0;
	for (let i = 1; i <= n; i++) {
		const time = i / 2;
		const cf = i === n ? 100 + c * 100 : c * 100;
		const pv = cf / (1 + y) ** i;
		price += pv;
		weightedCashflows += time * pv;
	}

	return weightedCashflows / price / (1 + y);
}

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
			gapUpperSelectionStrategy: "nearest",
			usePreLadderInterest: false,
			indexRatio: 1.0,
			currentHoldings: [],
			holdingPreferenceWeight: 1.0,
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
		gapUpperSelectionStrategy:
			optionsOrCurrentDate?.gapUpperSelectionStrategy ?? "nearest",
		usePreLadderInterest: optionsOrCurrentDate?.usePreLadderInterest ?? false,
		indexRatio: optionsOrCurrentDate?.indexRatio ?? 1.0,
		currentHoldings: optionsOrCurrentDate?.currentHoldings ?? [],
		holdingPreferenceWeight:
			optionsOrCurrentDate?.holdingPreferenceWeight ?? 1.0,
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

function createPositionId(
	coverageType: "exact" | "gap",
	targetYear: number,
	cusip: string,
	bracketRole?: GapBracketRole,
): string {
	if (coverageType === "exact") {
		return `exact:${targetYear}:${cusip}`;
	}
	return `gap:${targetYear}:${bracketRole ?? "unknown"}:${cusip}`;
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

function applyCoverageFromGapAllocation(
	requirements: Record<number, number>,
	bond: BondInfo,
	qty: number,
	gapYear: number,
	startYear: number,
	endYear: number,
	options: Required<BuildLadderOptions>,
) {
	const maturityYear = getMaturityYear(bond);
	for (let y = startYear; y <= endYear; y++) {
		if (y === gapYear) {
			requirements[y] -= qty * SYNTHETIC_GAP_LIQUIDATION_PER_HUNDRED;
			continue;
		}
		if (y === maturityYear) {
			requirements[y] -=
				qty *
				Math.max(
					0,
					getCashflowPerHundred(bond, y, options) -
						SYNTHETIC_GAP_LIQUIDATION_PER_HUNDRED,
				);
			continue;
		}
		requirements[y] -= qty * getCashflowPerHundred(bond, y, options);
	}
}

function getAllocationCoveragePerUnit(
	bond: BondInfo,
	allocation: LadderAllocation,
	year: number,
	options: Required<BuildLadderOptions>,
): number {
	if (allocation.coverageType === "gap" && allocation.targetYear === year) {
		return SYNTHETIC_GAP_LIQUIDATION_PER_HUNDRED;
	}
	if (allocation.coverageType === "gap") {
		const maturityYear = getMaturityYear(bond);
		if (year === maturityYear) {
			return Math.max(
				0,
				getCashflowPerHundred(bond, year, options) -
					SYNTHETIC_GAP_LIQUIDATION_PER_HUNDRED,
			);
		}
	}
	return getCashflowPerHundred(bond, year, options);
}

function rebuildRequirementsFromAllocations(
	targetIncome: number,
	startYear: number,
	endYear: number,
	allocations: LadderAllocation[],
	bondByCusip: Map<string, BondInfo>,
	options: Required<BuildLadderOptions>,
): Record<number, number> {
	const requirements: Record<number, number> = {};
	for (let y = startYear; y <= endYear; y++) requirements[y] = targetIncome;

	for (const allocation of allocations) {
		if (allocation.qty <= 0) continue;
		const bond = bondByCusip.get(allocation.cusip);
		if (!bond) continue;
		for (let y = startYear; y <= endYear; y++) {
			requirements[y] -=
				allocation.qty *
				getAllocationCoveragePerUnit(bond, allocation, y, options);
		}
	}

	return requirements;
}

function trimExactOverallocation(
	allocations: LadderAllocation[],
	bondByCusip: Map<string, BondInfo>,
	targetIncome: number,
	startYear: number,
	endYear: number,
	options: Required<BuildLadderOptions>,
) {
	const requirements = rebuildRequirementsFromAllocations(
		targetIncome,
		startYear,
		endYear,
		allocations,
		bondByCusip,
		options,
	);

	const exactAllocationsByCost = allocations
		.filter((allocation) => allocation.coverageType === "exact")
		.sort((a, b) => {
			const aBond = bondByCusip.get(a.cusip);
			const bBond = bondByCusip.get(b.cusip);
			const aCost = aBond ? getBondCostPerUnit(aBond) : 0;
			const bCost = bBond ? getBondCostPerUnit(bBond) : 0;
			return bCost - aCost;
		});

	for (const allocation of exactAllocationsByCost) {
		const bond = bondByCusip.get(allocation.cusip);
		if (!bond) continue;

		while (allocation.qty > 0) {
			let canRemoveOne = true;
			for (let year = startYear; year <= endYear; year++) {
				const coverage = getAllocationCoveragePerUnit(
					bond,
					allocation,
					year,
					options,
				);
				if (requirements[year] + coverage > MIN_NEED_THRESHOLD) {
					canRemoveOne = false;
					break;
				}
			}
			if (!canRemoveOne) break;

			allocation.qty -= 1;
			for (let year = startYear; year <= endYear; year++) {
				const coverage = getAllocationCoveragePerUnit(
					bond,
					allocation,
					year,
					options,
				);
				requirements[year] += coverage;
			}
		}
	}
}

function getBestExactMaturityBond(
	candidates: BondInfo[],
	year: number,
	options: Required<BuildLadderOptions>,
): BondInfo | undefined {
	const pref = options.holdingPreferenceWeight ?? 1.0;
	const holdings = options.currentHoldings || [];

	const viable = candidates
		.map((bond) => {
			const targetCf = getCashflowPerHundred(bond, year, options);
			if (targetCf <= MIN_NEED_THRESHOLD) return null;
			const isHeld = holdings.some((holding) => holding.cusip === bond.cusip);
			const cost = getBondCostPerUnit(bond);
			const efficiency = (cost * (isHeld ? pref : 1.0)) / targetCf;
			return { bond, efficiency };
		})
		.filter(
			(
				item,
			): item is {
				bond: BondInfo;
				efficiency: number;
			} => item !== null,
		)
		.sort((a, b) => a.efficiency - b.efficiency);

	return viable[0]?.bond;
}

function interpolateDurationWeights(
	lowerBond: BondInfo,
	upperBond: BondInfo,
	targetYear: number,
	settlementDate: Date,
): { lower: number; upper: number } {
	const y1 = getMaturityYear(lowerBond);
	const y2 = getMaturityYear(upperBond);
	if (y2 <= y1) return { lower: 0.5, upper: 0.5 };

	const interpolatedYield =
		lowerBond.yield +
		(upperBond.yield - lowerBond.yield) * ((targetYear - y1) / (y2 - y1));
	const syntheticCpn = syntheticCoupon(interpolatedYield);
	const syntheticMaturity = new Date(targetYear, 1, 15);
	const targetDuration = calculateModifiedDuration(
		settlementDate,
		syntheticMaturity,
		syntheticCpn,
		interpolatedYield,
	);
	const lowerDuration = calculateModifiedDuration(
		settlementDate,
		parseLocalDate(lowerBond.maturity),
		lowerBond.coupon,
		lowerBond.yield,
	);
	const upperDuration = calculateModifiedDuration(
		settlementDate,
		parseLocalDate(upperBond.maturity),
		upperBond.coupon,
		upperBond.yield,
	);
	if (
		!Number.isFinite(targetDuration) ||
		!Number.isFinite(lowerDuration) ||
		!Number.isFinite(upperDuration)
	) {
		return { lower: 0.5, upper: 0.5 };
	}

	const spread = upperDuration - lowerDuration;
	if (Math.abs(spread) < 1e-9) return { lower: 0.5, upper: 0.5 };

	const upper = clamp((targetDuration - lowerDuration) / spread, 0, 1);
	return { lower: 1 - upper, upper };
}

function createGapPair(
	lowerBond: BondInfo,
	upperBond: BondInfo,
	targetYear: number,
	settlementDate: Date,
): GapPair {
	const weights = interpolateDurationWeights(
		lowerBond,
		upperBond,
		targetYear,
		settlementDate,
	);
	return {
		lowerBond,
		upperBond,
		weights,
		blendedCostPerUnit:
			weights.lower * getBondCostPerUnit(lowerBond) +
			weights.upper * getBondCostPerUnit(upperBond),
	};
}

function findGapPair(
	eligibleBonds: BondInfo[],
	targetYear: number,
	options: Required<BuildLadderOptions>,
): GapPair | undefined {
	const lowerCandidates = eligibleBonds.filter(
		(bond) => getMaturityYear(bond) < targetYear,
	);
	const upperCandidates = eligibleBonds.filter(
		(bond) => getMaturityYear(bond) > targetYear,
	);
	if (lowerCandidates.length === 0 || upperCandidates.length === 0) {
		return undefined;
	}

	if (options.gapUpperSelectionStrategy === "nearest") {
		const lowerBond = [...lowerCandidates].sort(
			(a, b) => getMaturityYear(b) - getMaturityYear(a),
		)[0];
		const upperBond = [...upperCandidates].sort(
			(a, b) => getMaturityYear(a) - getMaturityYear(b),
		)[0];
		return createGapPair(
			lowerBond,
			upperBond,
			targetYear,
			options.settlementDate,
		);
	}

	const pref = options.holdingPreferenceWeight ?? 1.0;
	const holdings = options.currentHoldings || [];
	const nearestLowerBond = [...lowerCandidates].sort(
		(a, b) => getMaturityYear(b) - getMaturityYear(a),
	)[0];
	const pairs = upperCandidates
		.filter(
			(upperBond) =>
				getMaturityYear(upperBond) > getMaturityYear(nearestLowerBond),
		)
		.map((upperBond) =>
			createGapPair(
				nearestLowerBond,
				upperBond,
				targetYear,
				options.settlementDate,
			),
		);
	const viablePairs = pairs.filter(
		(pair) =>
			pair.weights.lower > MIN_NEED_THRESHOLD &&
			pair.weights.upper > MIN_NEED_THRESHOLD,
	);
	return (viablePairs.length > 0 ? viablePairs : pairs).sort((a, b) => {
		const aLowerHeld = holdings.some(
			(holding) => holding.cusip === a.lowerBond.cusip,
		);
		const aUpperHeld = holdings.some(
			(holding) => holding.cusip === a.upperBond.cusip,
		);
		const bLowerHeld = holdings.some(
			(holding) => holding.cusip === b.lowerBond.cusip,
		);
		const bUpperHeld = holdings.some(
			(holding) => holding.cusip === b.upperBond.cusip,
		);

		const aPref = (aLowerHeld ? pref : 1.0) * (aUpperHeld ? pref : 1.0);
		const bPref = (bLowerHeld ? pref : 1.0) * (bUpperHeld ? pref : 1.0);
		return a.blendedCostPerUnit * aPref - b.blendedCostPerUnit * bPref;
	})[0];
}

function applyGapPairAllocation(
	requirements: Record<number, number>,
	allocations: LadderAllocation[],
	gapPair: GapPair,
	netNeed: number,
	targetYear: number,
	startYear: number,
	endYear: number,
	options: Required<BuildLadderOptions>,
) {
	const legs: Array<{
		bond: BondInfo;
		weight: number;
		bracketRole: GapBracketRole;
	}> = [
		{
			bond: gapPair.lowerBond,
			weight: gapPair.weights.lower,
			bracketRole: "lower",
		},
		{
			bond: gapPair.upperBond,
			weight: gapPair.weights.upper,
			bracketRole: "upper",
		},
	];

	for (const leg of legs) {
		if (leg.weight <= MIN_NEED_THRESHOLD) continue;
		const allocatedNeed = netNeed * leg.weight;
		const coveragePerUnit = Math.max(
			getCashflowPerHundred(leg.bond, targetYear, options),
			SYNTHETIC_GAP_LIQUIDATION_PER_HUNDRED,
		);
		const qty = Math.ceil(allocatedNeed / coveragePerUnit);
		if (qty <= 0) continue;

		allocations.push({
			positionId: createPositionId(
				"gap",
				targetYear,
				leg.bond.cusip,
				leg.bracketRole,
			),
			cusip: leg.bond.cusip,
			qty,
			coverageType: "gap",
			targetYear,
			bracketRole: leg.bracketRole,
		});
		applyCoverageFromGapAllocation(
			requirements,
			leg.bond,
			qty,
			targetYear,
			startYear,
			endYear,
			options,
		);
	}
}

function comparePositionOrder(
	a: Pick<
		TargetPosition,
		"targetYear" | "coverageType" | "bracketRole" | "year" | "cusip"
	>,
	b: Pick<
		TargetPosition,
		"targetYear" | "coverageType" | "bracketRole" | "year" | "cusip"
	>,
): number {
	if (a.targetYear !== b.targetYear) return a.targetYear - b.targetYear;
	if (a.coverageType !== b.coverageType) {
		return a.coverageType === "exact" ? -1 : 1;
	}
	const aRole =
		a.bracketRole === "lower" ? 0 : a.bracketRole === "upper" ? 1 : 2;
	const bRole =
		b.bracketRole === "lower" ? 0 : b.bracketRole === "upper" ? 1 : 2;
	if (aRole !== bRole) return aRole - bRole;
	if (a.year !== b.year) return a.year - b.year;
	return a.cusip.localeCompare(b.cusip);
}

function materializePosition(
	allocation: Pick<
		LadderAllocation,
		| "positionId"
		| "cusip"
		| "qty"
		| "coverageType"
		| "targetYear"
		| "bracketRole"
	>,
	bondByCusip: Map<string, BondInfo>,
	fallback?: Partial<TargetPosition>,
): TargetPosition {
	const bond = bondByCusip.get(allocation.cusip);
	if (!bond && !fallback) {
		throw new Error(`Unknown target position CUSIP: ${allocation.cusip}`);
	}

	const year = bond
		? getMaturityYear(bond)
		: (fallback?.year ?? allocation.targetYear);
	const maturity = bond?.maturity ?? fallback?.maturity ?? "Unknown";
	const unitPrice =
		bond?.price !== undefined
			? getBondCostPerUnit(bond)
			: fallback?.qty && fallback.qty > 0 && fallback.cost !== undefined
				? fallback.cost / fallback.qty
				: 100;
	const coupon =
		bond?.coupon !== undefined
			? bond.coupon
			: fallback?.principal &&
				  fallback.principal > 0 &&
				  fallback.couponIncome !== undefined
				? fallback.couponIncome / fallback.principal
				: 0;

	return {
		positionId: allocation.positionId,
		cusip: allocation.cusip,
		maturity,
		year,
		qty: allocation.qty,
		cost: allocation.qty * unitPrice,
		principal: allocation.qty * 100,
		couponIncome: allocation.qty * 100 * coupon,
		coverageType: allocation.coverageType,
		targetYear: allocation.targetYear,
		bracketRole: allocation.bracketRole,
	};
}

function positionsToRungs(positions: TargetPosition[]): LadderRung[] {
	return [...positions]
		.map((position) => ({
			year: position.year,
			cusip: position.cusip,
			qty: position.qty,
			cost: position.cost,
			principal: position.principal,
			couponIncome: position.couponIncome,
			coverageType: position.coverageType,
			gapYear: position.targetYear,
			targetYear: position.targetYear,
			bracketRole: position.bracketRole,
			positionId: position.positionId,
		}))
		.sort(comparePositionOrder);
}

function getMaxCusipCostShare(positions: TargetPosition[]): number {
	const totalCost = positions.reduce((sum, position) => sum + position.cost, 0);
	if (totalCost <= MIN_NEED_THRESHOLD) return 0;

	const costByCusip = new Map<string, number>();
	for (const position of positions) {
		costByCusip.set(
			position.cusip,
			(costByCusip.get(position.cusip) || 0) + position.cost,
		);
	}

	let maxShare = 0;
	for (const cost of costByCusip.values()) {
		const share = cost / totalCost;
		if (share > maxShare) maxShare = share;
	}
	return maxShare;
}

function passesCheapestConcentrationGuardrail(result: LadderResult): boolean {
	return (
		getMaxCusipCostShare(result.positions) <= MAX_CHEAPEST_CUSIP_COST_SHARE
	);
}

function getGapUpperYearsByTarget(result: LadderResult): Map<number, number> {
	const upperYearsByTarget = new Map<number, number>();
	for (const position of result.positions) {
		if (position.coverageType !== "gap" || position.bracketRole !== "upper") {
			continue;
		}
		const existing = upperYearsByTarget.get(position.targetYear);
		if (existing === undefined || position.year < existing) {
			upperYearsByTarget.set(position.targetYear, position.year);
		}
	}
	return upperYearsByTarget;
}

function widensGapUpperPair(
	candidate: LadderResult,
	reference: LadderResult,
): boolean {
	const candidateUpperYears = getGapUpperYearsByTarget(candidate);
	const referenceUpperYears = getGapUpperYearsByTarget(reference);

	for (const [
		targetYear,
		candidateUpperYear,
	] of candidateUpperYears.entries()) {
		const referenceUpperYear = referenceUpperYears.get(targetYear);
		if (
			referenceUpperYear !== undefined &&
			candidateUpperYear > referenceUpperYear
		) {
			return true;
		}
	}

	return false;
}

function hasMaterialCostAdvantage(
	candidate: LadderResult,
	reference: LadderResult,
	minImprovementFraction: number,
): boolean {
	if (reference.totalCost <= MIN_NEED_THRESHOLD) return false;
	return (
		(reference.totalCost - candidate.totalCost) / reference.totalCost >=
		minImprovementFraction
	);
}

function buildLadderOnce(
	bonds: BondInfo[],
	targetIncome: number,
	startYear: number,
	endYear: number,
	options: Required<BuildLadderOptions>,
): LadderResult {
	const currentYear = options.settlementDate.getFullYear();
	const sortedBonds = [...bonds].sort((a, b) => {
		const yearCmp = getMaturityYear(a) - getMaturityYear(b);
		if (yearCmp !== 0) return yearCmp;
		return a.cusip.localeCompare(b.cusip);
	});
	const allocations: LadderAllocation[] = [];
	const bondByCusip = new Map(bonds.map((bond) => [bond.cusip, bond]));
	const eligibleBonds = sortedBonds.filter((bond) => {
		const year = getMaturityYear(bond);
		if (year < startYear) return false;
		if (options.allowOutOfHorizonMaturities) return true;
		return year <= endYear;
	});

	const requirements: Record<number, number> = {};
	for (let year = startYear; year <= endYear; year++) {
		requirements[year] = targetIncome;
	}

	if (options.usePreLadderInterest && startYear > currentYear) {
		const preLadderYears = startYear - currentYear;
		const preliminary = buildLadderOnce(
			bonds,
			targetIncome,
			startYear,
			endYear,
			{
				...options,
				usePreLadderInterest: false,
			},
		);
		const totalAnnualInterest = preliminary.positions.reduce(
			(sum, position) => sum + position.couponIncome,
			0,
		);
		let preLadderPool = preLadderYears * totalAnnualInterest;

		for (let year = startYear; year <= endYear; year++) {
			if (preLadderPool <= 0) break;
			const need = requirements[year];
			if (preLadderPool >= need) {
				requirements[year] = 0;
				preLadderPool -= need;
			} else {
				requirements[year] -= preLadderPool;
				preLadderPool = 0;
			}
		}
	}

	for (let targetYear = endYear; targetYear >= startYear; targetYear--) {
		const netNeed = requirements[targetYear];
		if (netNeed <= MIN_NEED_THRESHOLD) continue;

		const exactBond = getBestExactMaturityBond(
			eligibleBonds.filter((bond) => getMaturityYear(bond) === targetYear),
			targetYear,
			options,
		);

		if (exactBond) {
			const coveragePerUnit = getCashflowPerHundred(
				exactBond,
				targetYear,
				options,
			);
			if (coveragePerUnit <= MIN_NEED_THRESHOLD) continue;
			const qty = Math.ceil(netNeed / coveragePerUnit);
			if (qty <= 0) continue;

			allocations.push({
				positionId: createPositionId("exact", targetYear, exactBond.cusip),
				cusip: exactBond.cusip,
				qty,
				coverageType: "exact",
				targetYear,
			});
			applyCoverageFromBond(
				requirements,
				exactBond,
				qty,
				startYear,
				endYear,
				options,
			);
			continue;
		}

		const gapPair = findGapPair(eligibleBonds, targetYear, options);
		if (!gapPair) continue;
		applyGapPairAllocation(
			requirements,
			allocations,
			gapPair,
			netNeed,
			targetYear,
			startYear,
			endYear,
			options,
		);
	}

	trimExactOverallocation(
		allocations,
		bondByCusip,
		targetIncome,
		startYear,
		endYear,
		options,
	);

	const recalculatedRequirements = rebuildRequirementsFromAllocations(
		targetIncome,
		startYear,
		endYear,
		allocations,
		bondByCusip,
		options,
	);

	const positions = allocations
		.filter((allocation) => allocation.qty > 0)
		.map((allocation) => materializePosition(allocation, bondByCusip))
		.sort(comparePositionOrder);
	const unmetIncome: Record<number, number> = {};
	for (let year = startYear; year <= endYear; year++) {
		if (recalculatedRequirements[year] > MIN_NEED_THRESHOLD) {
			unmetIncome[year] = recalculatedRequirements[year];
		}
	}

	return {
		rungs: positionsToRungs(positions),
		totalCost: positions.reduce((sum, position) => sum + position.cost, 0),
		unmetIncome,
		positions,
	};
}

export function buildLadder(
	bonds: BondInfo[],
	targetIncome: number,
	startYear: number,
	endYear: number,
	optionsOrCurrentDate?: BuildLadderOptions | Date,
): LadderResult {
	const options = normalizeBuildOptions(optionsOrCurrentDate);
	const solveOptions = { ...options, strictUnmetLiability: false };
	const primary = buildLadderOnce(
		bonds,
		targetIncome,
		startYear,
		endYear,
		solveOptions,
	);
	let selected = primary;
	let nearestFallback: LadderResult | undefined;
	const getNearestFallback = (): LadderResult => {
		if (!nearestFallback) {
			nearestFallback = buildLadderOnce(
				bonds,
				targetIncome,
				startYear,
				endYear,
				{
					...solveOptions,
					gapUpperSelectionStrategy: "nearest",
				},
			);
		}
		return nearestFallback;
	};

	if (
		options.gapUpperSelectionStrategy === "cheapest" &&
		!passesCheapestConcentrationGuardrail(primary)
	) {
		const nearestFallback = getNearestFallback();
		if (passesCheapestConcentrationGuardrail(nearestFallback)) {
			selected = nearestFallback;
		} else if (nearestFallback.totalCost < primary.totalCost) {
			selected = nearestFallback;
		}
	}

	if (options.gapUpperSelectionStrategy === "cheapest") {
		const nearest = getNearestFallback();
		if (
			widensGapUpperPair(primary, nearest) &&
			!hasMaterialCostAdvantage(
				primary,
				nearest,
				MIN_CHEAPEST_WIDENING_IMPROVEMENT,
			)
		) {
			selected = nearest;
		}
	}

	if (
		options.strictUnmetLiability &&
		Object.keys(selected.unmetIncome).length > 0
	) {
		throw new Error(
			`Unmet income requirements for years: ${Object.keys(selected.unmetIncome).join(", ")}`,
		);
	}

	return selected;
}

function aggregateHoldings(holdings: Holding[]): Map<string, number> {
	const aggregated = new Map<string, number>();
	for (const holding of holdings) {
		aggregated.set(
			holding.cusip,
			(aggregated.get(holding.cusip) || 0) + holding.qty,
		);
	}
	return aggregated;
}

function inferCandidateExactYears(
	bonds: BondInfo[],
	currentHoldings: Holding[],
	startYear: number,
	endYear: number,
): number[] {
	if (currentHoldings.length === 0) return [];
	const bondByCusip = new Map(bonds.map((bond) => [bond.cusip, bond]));
	const heldYears = [
		...new Set(
			currentHoldings
				.map((holding) => bondByCusip.get(holding.cusip))
				.filter((bond): bond is BondInfo => Boolean(bond))
				.map((bond) => getMaturityYear(bond))
				.filter((year) => year >= startYear && year <= endYear),
		),
	];
	const heldYearSet = new Set(heldYears);
	if (heldYears.length === 0) return [];

	return [
		...new Set(
			bonds
				.map((bond) => getMaturityYear(bond))
				.filter((year) => year >= startYear && year <= endYear)
				.filter((year) => !heldYearSet.has(year))
				.filter(
					(year) =>
						heldYears.some((heldYear) => heldYear < year) &&
						heldYears.some((heldYear) => heldYear > year),
				),
		),
	].sort((a, b) => a - b);
}

function createOrphanPosition(
	cusip: string,
	qty: number,
	bondByCusip: Map<string, BondInfo>,
	index: number,
): TargetPosition {
	const bond = bondByCusip.get(cusip);
	const targetYear = bond ? getMaturityYear(bond) : Number.MAX_SAFE_INTEGER;
	return materializePosition(
		{
			positionId: `current-extra:${cusip}:${index}`,
			cusip,
			qty,
			coverageType: "gap",
			targetYear,
		},
		bondByCusip,
		bond
			? undefined
			: {
					maturity: "Unknown",
					year: targetYear,
					qty,
					cost: qty * 100,
					principal: qty * 100,
					couponIncome: 0,
				},
	);
}

function currentHoldingsAsPositions(
	currentHoldings: Holding[],
	bondByCusip: Map<string, BondInfo>,
): TargetPosition[] {
	const aggregated = aggregateHoldings(currentHoldings);
	const positions: TargetPosition[] = [];
	for (const [cusip, qty] of aggregated.entries()) {
		const bond = bondByCusip.get(cusip);
		const targetYear = bond ? getMaturityYear(bond) : Number.MAX_SAFE_INTEGER;
		positions.push(
			materializePosition(
				{
					positionId: createPositionId("exact", targetYear, cusip),
					cusip,
					qty,
					coverageType: "exact",
					targetYear,
				},
				bondByCusip,
				bond
					? undefined
					: {
							maturity: "Unknown",
							year: targetYear,
							qty,
							cost: qty * 100,
							principal: qty * 100,
							couponIncome: 0,
						},
			),
		);
	}
	return positions.sort(comparePositionOrder);
}

function projectHoldingsOntoPositions(
	templatePositions: TargetPosition[],
	currentHoldings: Holding[],
	bondByCusip: Map<string, BondInfo>,
): TargetPosition[] {
	const currentByCusip = aggregateHoldings(currentHoldings);
	const templatesByCusip = new Map<string, TargetPosition[]>();
	for (const template of [...templatePositions].sort(comparePositionOrder)) {
		const existing = templatesByCusip.get(template.cusip) || [];
		existing.push(template);
		templatesByCusip.set(template.cusip, existing);
	}

	const projected: TargetPosition[] = [];
	let orphanIndex = 0;
	for (const [cusip, qty] of currentByCusip.entries()) {
		const templates = templatesByCusip.get(cusip) || [];
		if (templates.length === 0) {
			projected.push(
				createOrphanPosition(cusip, qty, bondByCusip, orphanIndex++),
			);
			continue;
		}

		let remaining = qty;
		for (const template of templates) {
			const assignedQty = Math.min(template.qty, remaining);
			if (assignedQty > 0) {
				projected.push(
					materializePosition(
						{
							positionId: template.positionId,
							cusip: template.cusip,
							qty: assignedQty,
							coverageType: template.coverageType,
							targetYear: template.targetYear,
							bracketRole: template.bracketRole,
						},
						bondByCusip,
						template,
					),
				);
				remaining -= assignedQty;
			}
		}

		if (remaining > 0) {
			projected.push(
				createOrphanPosition(cusip, remaining, bondByCusip, orphanIndex++),
			);
		}
	}

	return projected.sort(comparePositionOrder);
}

function resolveCurrentPositions(
	bonds: BondInfo[],
	currentHoldings: Holding[],
	targetIncome: number,
	startYear: number,
	endYear: number,
	options: RebalanceOptions,
): TargetPosition[] {
	if (currentHoldings.length === 0) return [];
	const bondByCusip = new Map(bonds.map((bond) => [bond.cusip, bond]));

	if (
		options.currentTargetPositions &&
		options.currentTargetPositions.length > 0
	) {
		return projectHoldingsOntoPositions(
			options.currentTargetPositions,
			currentHoldings,
			bondByCusip,
		);
	}

	const candidateExactYears = inferCandidateExactYears(
		bonds,
		currentHoldings,
		startYear,
		endYear,
	);
	if (candidateExactYears.length === 0) {
		return currentHoldingsAsPositions(currentHoldings, bondByCusip);
	}
	const filteredBonds =
		candidateExactYears.length > 0
			? bonds.filter(
					(bond) => !candidateExactYears.includes(getMaturityYear(bond)),
				)
			: bonds;
	const template = buildLadder(
		filteredBonds,
		targetIncome,
		startYear,
		endYear,
		{
			...options,
			currentHoldings: [],
			holdingPreferenceWeight: 1.0,
		},
	).positions;

	return projectHoldingsOntoPositions(template, currentHoldings, bondByCusip);
}

function getPositionUnitPrice(
	position: TargetPosition,
	bondByCusip: Map<string, BondInfo>,
	unknownHoldingPolicy: "error" | "conservative-price",
): number {
	const bond = bondByCusip.get(position.cusip);
	if (!bond) {
		if (unknownHoldingPolicy === "error") {
			throw new Error(`Unknown holding CUSIP: ${position.cusip}`);
		}
		if (position.qty > 0) {
			return position.cost / position.qty;
		}
		return 100;
	}
	return getBondCostPerUnit(bond);
}

function isTinyTrade(
	diff: number,
	unitPrice: number,
	options: RebalanceOptions,
): boolean {
	return (
		Math.abs(diff) < (options.minTradeQtyThreshold ?? 0) ||
		Math.abs(diff * unitPrice) < (options.minTradeCostThreshold ?? 0)
	);
}

function buildTrade(
	positionId: string,
	currentPosition: TargetPosition | undefined,
	targetPosition: TargetPosition | undefined,
	currentQty: number,
	targetQty: number,
	unitPrice: number,
): Trade {
	const delta = targetQty - currentQty;
	const reference = targetPosition ?? currentPosition;
	const action = delta > 0 ? "BUY" : delta < 0 ? "SELL" : "HOLD";
	const isOrphanPosition = positionId.startsWith("current-extra:");
	let intent: TradeIntent | undefined;
	if (action === "BUY") {
		intent =
			targetPosition?.coverageType === "exact" ? "exact-match" : "gap-bridge";
	} else if (action === "SELL") {
		intent = isOrphanPosition
			? "maintenance"
			: currentPosition?.coverageType === "gap"
				? "gap-bridge"
				: "maintenance";
	}

	return {
		positionId,
		cusip: reference?.cusip ?? "",
		action,
		qty: action === "HOLD" ? targetQty : Math.abs(delta),
		currentQty,
		targetQty,
		estimatedPrice: unitPrice,
		estimatedCost: delta * unitPrice,
		intent,
		gapYear: isOrphanPosition ? undefined : reference?.targetYear,
		targetYear: isOrphanPosition ? undefined : reference?.targetYear,
		bracketRole: isOrphanPosition ? undefined : reference?.bracketRole,
	};
}

function sortTrades(a: Trade, b: Trade): number {
	const aYear = a.targetYear ?? Number.MAX_SAFE_INTEGER;
	const bYear = b.targetYear ?? Number.MAX_SAFE_INTEGER;
	if (aYear !== bYear) return aYear - bYear;
	const aAction = a.action === "BUY" ? 0 : a.action === "HOLD" ? 1 : 2;
	const bAction = b.action === "BUY" ? 0 : b.action === "HOLD" ? 1 : 2;
	if (aAction !== bAction) return aAction - bAction;
	return a.cusip.localeCompare(b.cusip);
}

function buildUpgradeGroups(trades: Trade[]): RebalanceUpgradeGroup[] {
	const groups = new Map<number, { buy?: Trade; sells: Trade[] }>();
	for (const trade of trades) {
		if (trade.targetYear === undefined || trade.action === "HOLD") continue;
		const existing = groups.get(trade.targetYear) || { sells: [] };
		if (trade.action === "BUY" && trade.intent === "exact-match") {
			existing.buy = trade;
		}
		if (trade.action === "SELL" && trade.intent === "gap-bridge") {
			existing.sells.push(trade);
		}
		groups.set(trade.targetYear, existing);
	}

	return [...groups.entries()]
		.filter(([, group]) => group.buy && group.sells.length > 0)
		.map(([targetYear, group]) => ({
			targetYear,
			buy: group.buy!,
			sells: group.sells.sort(sortTrades),
			netCost:
				group.buy!.estimatedCost +
				group.sells.reduce((sum, sell) => sum + sell.estimatedCost, 0),
		}))
		.sort((a, b) => a.targetYear - b.targetYear);
}

export function calculateRebalance(
	bonds: BondInfo[],
	currentHoldings: Holding[],
	targetIncome: number,
	startYear: number,
	endYear: number,
	options: RebalanceOptions = {},
): RebalanceResult {
	const desiredTarget = buildLadder(bonds, targetIncome, startYear, endYear, {
		...options,
		currentHoldings,
	});
	const currentPositions = resolveCurrentPositions(
		bonds,
		currentHoldings,
		targetIncome,
		startYear,
		endYear,
		options,
	);
	const currentById = new Map(
		currentPositions.map((position) => [position.positionId, position]),
	);
	const desiredById = new Map(
		desiredTarget.positions.map((position) => [position.positionId, position]),
	);
	const allPositionIds = [
		...new Set([...currentById.keys(), ...desiredById.keys()]),
	];
	const bondByCusip = new Map(bonds.map((bond) => [bond.cusip, bond]));
	const unknownHoldingPolicy =
		options.unknownHoldingCusipPolicy ?? "conservative-price";

	const trades: Trade[] = [];
	const appliedPositions: TargetPosition[] = [];
	for (const positionId of allPositionIds) {
		const currentPosition = currentById.get(positionId);
		const desiredPosition = desiredById.get(positionId);
		const currentQty = currentPosition?.qty ?? 0;
		const rawTargetQty = desiredPosition?.qty ?? 0;
		const reference = desiredPosition ?? currentPosition;
		if (!reference) continue;

		const unitPrice = getPositionUnitPrice(
			reference,
			bondByCusip,
			unknownHoldingPolicy,
		);
		const diff = rawTargetQty - currentQty;
		const effectiveTargetQty =
			diff !== 0 && isTinyTrade(diff, unitPrice, options)
				? currentQty
				: rawTargetQty;
		const trade = buildTrade(
			positionId,
			currentPosition,
			desiredPosition,
			currentQty,
			effectiveTargetQty,
			unitPrice,
		);
		trades.push(trade);

		if (effectiveTargetQty > 0) {
			appliedPositions.push(
				materializePosition(
					{
						positionId,
						cusip: reference.cusip,
						qty: effectiveTargetQty,
						coverageType: reference.coverageType,
						targetYear: reference.targetYear,
						bracketRole: reference.bracketRole,
					},
					bondByCusip,
					reference,
				),
			);
		}
	}

	const sortedPositions = appliedPositions.sort(comparePositionOrder);
	const sortedTrades = trades.sort(sortTrades);
	const holdingsAfter = sortedPositions.map((position) => ({
		cusip: position.cusip,
		qty: position.qty,
	}));
	const totalNetCost = sortedTrades.reduce(
		(sum, trade) => sum + (trade.action === "HOLD" ? 0 : trade.estimatedCost),
		0,
	);

	return {
		targetLadder: positionsToRungs(sortedPositions),
		targetPositions: sortedPositions,
		currentPositions,
		trades: sortedTrades,
		totalNetCost,
		unmetIncome: desiredTarget.unmetIncome,
		holdingsAfter,
		upgradeGroups: buildUpgradeGroups(sortedTrades),
	};
}
