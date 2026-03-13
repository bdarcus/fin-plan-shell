/**
 * Pure headless math engine for TIPS ladder generation and rebalancing.
 * Implements the Pfau/DARA (Desired Annual Real Amount) method with Duration Matching.
 *
 * Portions of the financial logic (synthetic coupon interpolation and pre-ladder
 * interest analysis) are inspired by or adapted from
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

interface SyntheticGapProfile {
	targetYear: number;
	netNeed: number;
	syntheticYield: number;
	syntheticCoupon: number;
	syntheticDuration: number;
	syntheticPiPerUnit: number;
	syntheticQty: number;
	syntheticCost: number;
}

interface GapPlan {
	lowerBond: BondInfo;
	upperBond: BondInfo;
	weights: { lower: number; upper: number };
	blendedCostPerUnit: number;
	profiles: SyntheticGapProfile[];
	lowerQtyTotal: number;
	upperQtyTotal: number;
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

/**
 * Quantizes a synthetic gap coupon to the auction coupon grid used by TIPS.
 */
function syntheticCoupon(yld: number): number {
	return Math.max(0.00125, Math.floor((yld * 100) / 0.125) * 0.00125);
}

/**
 * Counts the remaining semi-annual coupon periods between settlement and maturity.
 */
function getNumPeriods(settlement: Date, maturity: Date): number {
	const months =
		(maturity.getFullYear() - settlement.getFullYear()) * 12 +
		(maturity.getMonth() - settlement.getMonth());
	return Math.ceil(months / 6);
}

/**
 * Approximates modified duration for a semi-annual real coupon bond.
 */
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

/**
 * Parses an ISO-like date string without introducing UTC timezone drift.
 */
function parseLocalDate(str: string): Date {
	const [y, m, d] = str.split("-").map(Number);
	return new Date(y, m - 1, d);
}

/**
 * Returns a copy of a date shifted by a whole number of calendar months.
 */
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

/**
 * Drops the time component so settlement comparisons happen at day precision.
 */
function startOfDay(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Normalizes the ladder builder options and fills all defaults.
 */
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

/**
 * Returns the calendar year in which a bond matures.
 */
function getMaturityYear(bond: BondInfo): number {
	return parseLocalDate(bond.maturity).getFullYear();
}

/**
 * Returns the inflation-adjusted principal represented by one bond unit.
 */
function getAdjustedPrincipalPerUnit(bond: BondInfo): number {
	return 100 * bond.indexRatio;
}

/**
 * Returns the principal paid at maturity, optionally applying the deflation floor.
 */
function getMaturityPrincipalPerUnit(
	bond: BondInfo,
	options: Required<BuildLadderOptions>,
): number {
	const adjustedPrincipal = getAdjustedPrincipalPerUnit(bond);
	if (!options.maturityDeflationFloor) return adjustedPrincipal;
	return Math.max(100, adjustedPrincipal);
}

/**
 * Converts a quoted clean price into per-unit cost using adjusted principal.
 */
function getBondCostPerUnit(bond: BondInfo): number {
	return (bond.price / 100) * getAdjustedPrincipalPerUnit(bond);
}

/**
 * Returns one full year of coupon income for a bond unit.
 */
function getAnnualInterestPerUnit(bond: BondInfo): number {
	return getAdjustedPrincipalPerUnit(bond) * bond.coupon;
}

/**
 * Approximates how much of the last coupon year is realized at maturity.
 */
function getFinalYearInterestFactor(bond: BondInfo): number {
	return parseLocalDate(bond.maturity).getMonth() + 1 < 7 ? 0.5 : 1.0;
}

/**
 * Returns the coupon income included in the maturity year.
 */
function getLastYearInterestPerUnit(bond: BondInfo): number {
	return getAnnualInterestPerUnit(bond) * getFinalYearInterestFactor(bond);
}

/**
 * Returns principal plus final-year interest for one maturity-year unit.
 */
function getPiPerUnit(
	bond: BondInfo,
	options: Required<BuildLadderOptions>,
): number {
	return (
		getMaturityPrincipalPerUnit(bond, options) +
		getLastYearInterestPerUnit(bond)
	);
}

/**
 * Clamps a numeric value into the inclusive range.
 */
function clamp(n: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, n));
}

/**
 * Builds the stable synthetic/exact position identifier used across ladder states.
 */
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

/**
 * Computes exact year-by-year cash flow for a bond using settlement-aware coupon dates.
 */
function getExactCashflowPerHundred(
	bond: BondInfo,
	year: number,
	options: Required<BuildLadderOptions>,
): number {
	const maturity = parseLocalDate(bond.maturity);
	const maturityYear = maturity.getFullYear();
	if (year > maturityYear) return 0;

	const payoutCoupon = getAdjustedPrincipalPerUnit(bond) * (bond.coupon / 2);
	const settlement = startOfDay(options.settlementDate);
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
		cashflow += getMaturityPrincipalPerUnit(bond, options);
	}
	return cashflow;
}

/**
 * Computes the simplified annual approximation used by the legacy ladder model.
 */
function getApproxCashflowPerHundred(
	bond: BondInfo,
	year: number,
	options: Required<BuildLadderOptions>,
): number {
	const maturityYear = getMaturityYear(bond);
	if (year > maturityYear) return 0;
	if (year === maturityYear) return getPiPerUnit(bond, options);
	return getAnnualInterestPerUnit(bond);
}

/**
 * Selects the configured cash-flow model for the requested year.
 */
function getCashflowPerHundred(
	bond: BondInfo,
	year: number,
	options: Required<BuildLadderOptions>,
): number {
	if (options.modelFidelity === "annual-approx") {
		return getApproxCashflowPerHundred(bond, year, options);
	}
	return getExactCashflowPerHundred(bond, year, options);
}

/**
 * Applies an exact-maturity allocation's coverage across the liability years.
 */
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

/**
 * Applies a synthetic gap allocation, separating liquidation value from bond cash flow.
 */
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

/**
 * Returns how much one allocated unit contributes to a specific target year.
 */
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

/**
 * Seeds the liability schedule with the same target income for each year.
 */
function createBaseRequirements(
	targetIncome: number,
	startYear: number,
	endYear: number,
): Record<number, number> {
	const requirements: Record<number, number> = {};
	for (let y = startYear; y <= endYear; y++) requirements[y] = targetIncome;
	return requirements;
}

/**
 * Recomputes remaining liabilities after applying the current allocations.
 */
function rebuildRequirementsFromAllocations(
	baseRequirements: Record<number, number>,
	startYear: number,
	endYear: number,
	allocations: LadderAllocation[],
	bondByCusip: Map<string, BondInfo>,
	options: Required<BuildLadderOptions>,
): Record<number, number> {
	const requirements = { ...baseRequirements };

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

/**
 * Removes excess exact-match units while preserving full funding of every year.
 */
function trimExactOverallocation(
	allocations: LadderAllocation[],
	bondByCusip: Map<string, BondInfo>,
	baseRequirements: Record<number, number>,
	startYear: number,
	endYear: number,
	options: Required<BuildLadderOptions>,
) {
	const requirements = rebuildRequirementsFromAllocations(
		baseRequirements,
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

/**
 * Picks the preferred exact-maturity bond, favoring later maturities and held bonds.
 */
function getBestExactMaturityBond(
	candidates: BondInfo[],
	options: Required<BuildLadderOptions>,
): BondInfo | undefined {
	if (candidates.length === 0) return undefined;

	const pref = options.holdingPreferenceWeight ?? 1.0;
	const heldCusips = new Set(
		(options.currentHoldings ?? []).map((holding) => holding.cusip),
	);
	const latestMaturity = Math.max(
		...candidates.map((bond) => parseLocalDate(bond.maturity).getTime()),
	);

	return candidates
		.filter(
			(bond) => parseLocalDate(bond.maturity).getTime() === latestMaturity,
		)
		.sort((a, b) => {
			const aHeld = heldCusips.has(a.cusip);
			const bHeld = heldCusips.has(b.cusip);
			const aScore = getBondCostPerUnit(a) * (aHeld ? pref : 1.0);
			const bScore = getBondCostPerUnit(b) * (bHeld ? pref : 1.0);
			if (aScore !== bScore) return aScore - bScore;
			return a.cusip.localeCompare(b.cusip);
		})[0];
}

/**
 * Chooses the best exact-match candidate bond for each maturity year.
 */
function buildSelectedBondByYear(
	bonds: BondInfo[],
	startYear: number,
	endYear: number,
	options: Required<BuildLadderOptions>,
): Map<number, BondInfo> {
	const selected = new Map<number, BondInfo>();

	for (const bond of bonds) {
		const maturity = parseLocalDate(bond.maturity);
		const year = maturity.getFullYear();
		if (maturity <= options.settlementDate) continue;
		if (year < startYear) continue;
		if (!options.allowOutOfHorizonMaturities && year > endYear) continue;

		const existing = selected.get(year);
		if (!existing) {
			selected.set(year, bond);
			continue;
		}

		const best = getBestExactMaturityBond([existing, bond], options);
		if (best) selected.set(year, best);
	}

	return selected;
}

/**
 * Linearly interpolates a synthetic real yield between the gap's bracketing bonds.
 */
function interpolateGapYield(
	lowerBond: BondInfo,
	upperBond: BondInfo,
	targetYear: number,
): number {
	const lowerMaturity = parseLocalDate(lowerBond.maturity);
	const upperMaturity = parseLocalDate(upperBond.maturity);
	if (upperMaturity <= lowerMaturity) return upperBond.yield;

	const syntheticMaturity = new Date(targetYear, 1, 15);
	return (
		lowerBond.yield +
		((syntheticMaturity.getTime() - lowerMaturity.getTime()) *
			(upperBond.yield - lowerBond.yield)) /
			(upperMaturity.getTime() - lowerMaturity.getTime())
	);
}

/**
 * Computes lower and upper bond weights that match a target duration.
 */
function interpolateDurationWeights(
	lowerBond: BondInfo,
	upperBond: BondInfo,
	targetDuration: number,
	settlementDate: Date,
): { lower: number; upper: number } {
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

/**
 * Builds the synthetic target profile used to size one uncovered gap year.
 */
function createSyntheticGapProfile(
	targetYear: number,
	netNeed: number,
	lowerBond: BondInfo,
	upperBond: BondInfo,
	settlementDate: Date,
): SyntheticGapProfile {
	const syntheticYield = interpolateGapYield(lowerBond, upperBond, targetYear);
	const syntheticCouponRate = syntheticCoupon(syntheticYield);
	const syntheticDuration = calculateModifiedDuration(
		settlementDate,
		new Date(targetYear, 1, 15),
		syntheticCouponRate,
		syntheticYield,
	);
	const syntheticPiPerUnit = 100 + 100 * syntheticCouponRate * 0.5;
	const syntheticQty =
		netNeed > MIN_NEED_THRESHOLD ? Math.ceil(netNeed / syntheticPiPerUnit) : 0;

	return {
		targetYear,
		netNeed,
		syntheticYield,
		syntheticCoupon: syntheticCouponRate,
		syntheticDuration,
		syntheticPiPerUnit,
		syntheticQty,
		syntheticCost: syntheticQty * 100,
	};
}

/**
 * Builds a two-bond synthetic plan that covers one or more missing maturity years.
 */
function buildGapPlan(
	gapYears: number[],
	requirements: Record<number, number>,
	lowerBond: BondInfo,
	upperBond: BondInfo,
	options: Required<BuildLadderOptions>,
): GapPlan {
	const profiles = gapYears.map((gapYear) =>
		createSyntheticGapProfile(
			gapYear,
			Math.max(0, requirements[gapYear] ?? 0),
			lowerBond,
			upperBond,
			options.settlementDate,
		),
	);
	const durationProfiles = profiles.filter(
		(profile) =>
			profile.syntheticQty > 0 && Number.isFinite(profile.syntheticDuration),
	);
	const avgDuration =
		durationProfiles.length > 0
			? durationProfiles.reduce(
					(sum, profile) => sum + profile.syntheticDuration,
					0,
				) / durationProfiles.length
			: calculateModifiedDuration(
					options.settlementDate,
					new Date(
						gapYears[Math.floor(gapYears.length / 2)] ?? gapYears[0],
						1,
						15,
					),
					syntheticCoupon(
						interpolateGapYield(
							lowerBond,
							upperBond,
							gapYears[Math.floor(gapYears.length / 2)] ?? gapYears[0],
						),
					),
					interpolateGapYield(
						lowerBond,
						upperBond,
						gapYears[Math.floor(gapYears.length / 2)] ?? gapYears[0],
					),
				);
	const weights = interpolateDurationWeights(
		lowerBond,
		upperBond,
		avgDuration,
		options.settlementDate,
	);
	const totalSyntheticCost = profiles.reduce(
		(sum, profile) => sum + profile.syntheticCost,
		0,
	);

	return {
		lowerBond,
		upperBond,
		weights,
		blendedCostPerUnit:
			weights.lower * getBondCostPerUnit(lowerBond) +
			weights.upper * getBondCostPerUnit(upperBond),
		profiles,
		lowerQtyTotal:
			getBondCostPerUnit(lowerBond) > MIN_NEED_THRESHOLD
				? Math.round(
						(totalSyntheticCost * weights.lower) /
							getBondCostPerUnit(lowerBond),
					)
				: 0,
		upperQtyTotal:
			getBondCostPerUnit(upperBond) > MIN_NEED_THRESHOLD
				? Math.round(
						(totalSyntheticCost * weights.upper) /
							getBondCostPerUnit(upperBond),
					)
				: 0,
	};
}

/**
 * Finds the lower/upper bond pair used to fund a contiguous gap segment.
 */
function findGapPlan(
	selectedBondByYear: Map<number, BondInfo>,
	gapYears: number[],
	requirements: Record<number, number>,
	options: Required<BuildLadderOptions>,
): GapPlan | undefined {
	const years = [...selectedBondByYear.keys()].sort((a, b) => a - b);
	const firstGapYear = gapYears[0];
	const lastGapYear = gapYears[gapYears.length - 1];
	const lowerYear = [...years].filter((year) => year < firstGapYear).at(-1);
	const upperYears = years.filter((year) => year > lastGapYear);
	if (lowerYear === undefined || upperYears.length === 0) {
		return undefined;
	}

	const lowerBond = selectedBondByYear.get(lowerYear);
	if (!lowerBond) return undefined;

	if (options.gapUpperSelectionStrategy === "nearest") {
		const upperBond = selectedBondByYear.get(upperYears[0]);
		return upperBond
			? buildGapPlan(gapYears, requirements, lowerBond, upperBond, options)
			: undefined;
	}

	const pref = options.holdingPreferenceWeight ?? 1.0;
	const heldCusips = new Set(
		(options.currentHoldings ?? []).map((holding) => holding.cusip),
	);
	const plans = upperYears
		.map((upperYear) => selectedBondByYear.get(upperYear))
		.filter((bond): bond is BondInfo => Boolean(bond))
		.map((upperBond) =>
			buildGapPlan(gapYears, requirements, lowerBond, upperBond, options),
		);
	const viablePlans = plans.filter(
		(plan) =>
			plan.weights.lower > MIN_NEED_THRESHOLD &&
			plan.weights.upper > MIN_NEED_THRESHOLD,
	);

	return (viablePlans.length > 0 ? viablePlans : plans).sort((a, b) => {
		const aPref =
			(heldCusips.has(a.lowerBond.cusip) ? pref : 1.0) *
			(heldCusips.has(a.upperBond.cusip) ? pref : 1.0);
		const bPref =
			(heldCusips.has(b.lowerBond.cusip) ? pref : 1.0) *
			(heldCusips.has(b.upperBond.cusip) ? pref : 1.0);
		const scoreDiff =
			a.blendedCostPerUnit * aPref - b.blendedCostPerUnit * bPref;
		if (Math.abs(scoreDiff) > 1e-9) return scoreDiff;
		return getMaturityYear(a.upperBond) - getMaturityYear(b.upperBond);
	})[0];
}

/**
 * Splits a synthetic leg's rounded quantity across the gap years it funds.
 */
function distributeGapQtyByYear(
	profiles: SyntheticGapProfile[],
	totalQty: number,
	weight: number,
	unitCost: number,
): Map<number, number> {
	const distribution = new Map<number, number>();
	if (totalQty <= 0 || unitCost <= MIN_NEED_THRESHOLD) return distribution;

	const rawShares = profiles
		.map((profile) => ({
			targetYear: profile.targetYear,
			rawQty: (profile.syntheticCost * weight) / unitCost,
		}))
		.filter((share) => share.rawQty > MIN_NEED_THRESHOLD);
	if (rawShares.length === 0) return distribution;

	const baseShares = rawShares.map((share) => ({
		...share,
		qty: Math.floor(share.rawQty),
		remainder: share.rawQty - Math.floor(share.rawQty),
	}));
	let assigned = 0;
	for (const share of baseShares) {
		distribution.set(share.targetYear, share.qty);
		assigned += share.qty;
	}

	let remaining = totalQty - assigned;
	const byRemainder = [...baseShares].sort((a, b) => {
		if (b.remainder !== a.remainder) return b.remainder - a.remainder;
		return a.targetYear - b.targetYear;
	});
	for (let i = 0; i < byRemainder.length && remaining > 0; i++) {
		const share = byRemainder[i];
		distribution.set(
			share.targetYear,
			(distribution.get(share.targetYear) ?? 0) + 1,
		);
		remaining -= 1;
		if (i === byRemainder.length - 1 && remaining > 0) i = -1;
	}

	return distribution;
}

/**
 * Appends the concrete lower/upper synthetic allocations for a solved gap plan.
 */
function appendGapPlanAllocations(
	requirements: Record<number, number>,
	allocations: LadderAllocation[],
	gapPlan: GapPlan,
	startYear: number,
	endYear: number,
	options: Required<BuildLadderOptions>,
) {
	const legs: Array<{
		bond: BondInfo;
		totalQty: number;
		weight: number;
		bracketRole: GapBracketRole;
	}> = [
		{
			bond: gapPlan.lowerBond,
			totalQty: gapPlan.lowerQtyTotal,
			weight: gapPlan.weights.lower,
			bracketRole: "lower",
		},
		{
			bond: gapPlan.upperBond,
			totalQty: gapPlan.upperQtyTotal,
			weight: gapPlan.weights.upper,
			bracketRole: "upper",
		},
	];

	for (const leg of legs) {
		const qtyByYear = distributeGapQtyByYear(
			gapPlan.profiles,
			leg.totalQty,
			leg.weight,
			getBondCostPerUnit(leg.bond),
		);
		for (const profile of [...gapPlan.profiles].sort(
			(a, b) => b.targetYear - a.targetYear,
		)) {
			const qty = qtyByYear.get(profile.targetYear) ?? 0;
			if (qty <= 0) continue;

			allocations.push({
				positionId: createPositionId(
					"gap",
					profile.targetYear,
					leg.bond.cusip,
					leg.bracketRole,
				),
				cusip: leg.bond.cusip,
				qty,
				coverageType: "gap",
				targetYear: profile.targetYear,
				bracketRole: leg.bracketRole,
			});
			applyCoverageFromGapAllocation(
				requirements,
				leg.bond,
				qty,
				profile.targetYear,
				startYear,
				endYear,
				options,
			);
		}
	}
}

/**
 * Sorts positions and rungs in a stable target-year, coverage, and maturity order.
 */
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

/**
 * Materializes a normalized target position from a lightweight allocation record.
 */
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
	const unitPrincipal =
		bond !== undefined
			? getAdjustedPrincipalPerUnit(bond)
			: fallback?.qty && fallback.qty > 0 && fallback.principal !== undefined
				? fallback.principal / fallback.qty
				: 100;
	const annualInterestPerUnit =
		bond !== undefined
			? getAnnualInterestPerUnit(bond)
			: fallback?.qty && fallback.qty > 0 && fallback.couponIncome !== undefined
				? fallback.couponIncome / fallback.qty
				: 0;

	return {
		positionId: allocation.positionId,
		cusip: allocation.cusip,
		maturity,
		year,
		qty: allocation.qty,
		cost: allocation.qty * unitPrice,
		principal: allocation.qty * unitPrincipal,
		couponIncome: allocation.qty * annualInterestPerUnit,
		coverageType: allocation.coverageType,
		targetYear: allocation.targetYear,
		bracketRole: allocation.bracketRole,
	};
}

/**
 * Converts normalized positions into the ladder rung view consumed by the UI.
 */
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

/**
 * Returns the largest single-CUSIP share of total ladder cost.
 */
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

/**
 * Enforces the concentration guardrail used by the cheapest synthetic strategy.
 */
function passesCheapestConcentrationGuardrail(result: LadderResult): boolean {
	return (
		getMaxCusipCostShare(result.positions) <= MAX_CHEAPEST_CUSIP_COST_SHARE
	);
}

/**
 * Maps each synthetic target year to the maturity year of its chosen upper leg.
 */
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

/**
 * Returns whether a candidate solution widens any gap's upper maturity versus a reference.
 */
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

/**
 * Returns whether a candidate meaningfully improves total cost versus a reference.
 */
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

/**
 * Splits the horizon into contiguous years lacking exact-maturity bonds.
 */
function findGapSegments(
	exactYears: Set<number>,
	startYear: number,
	endYear: number,
): number[][] {
	const segments: number[][] = [];
	let currentSegment: number[] = [];

	for (let year = startYear; year <= endYear; year++) {
		if (exactYears.has(year)) {
			if (currentSegment.length > 0) {
				segments.push(currentSegment);
				currentSegment = [];
			}
			continue;
		}
		currentSegment.push(year);
	}

	if (currentSegment.length > 0) segments.push(currentSegment);
	return segments;
}

/**
 * Solves one ladder instance without any cheapest-strategy fallback logic.
 */
function buildLadderOnce(
	bonds: BondInfo[],
	targetIncome: number,
	startYear: number,
	endYear: number,
	options: Required<BuildLadderOptions>,
): LadderResult {
	const currentYear = options.settlementDate.getFullYear();
	const bondByCusip = new Map(bonds.map((bond) => [bond.cusip, bond]));
	const selectedBondByYear = buildSelectedBondByYear(
		bonds,
		startYear,
		endYear,
		options,
	);
	const exactYears = new Set(
		[...selectedBondByYear.keys()].filter(
			(year) => year >= startYear && year <= endYear,
		),
	);
	const baseRequirements = createBaseRequirements(
		targetIncome,
		startYear,
		endYear,
	);

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
			const need = baseRequirements[year];
			if (preLadderPool >= need) {
				baseRequirements[year] = 0;
				preLadderPool -= need;
			} else {
				baseRequirements[year] -= preLadderPool;
				preLadderPool = 0;
			}
		}
	}

	const exactAllocations: LadderAllocation[] = [];
	const exactRequirements = { ...baseRequirements };
	for (let targetYear = endYear; targetYear >= startYear; targetYear--) {
		const exactBond = selectedBondByYear.get(targetYear);
		if (!exactBond) continue;

		const netNeed = exactRequirements[targetYear];
		if (netNeed <= MIN_NEED_THRESHOLD) continue;

		const coveragePerUnit = getCashflowPerHundred(
			exactBond,
			targetYear,
			options,
		);
		if (coveragePerUnit <= MIN_NEED_THRESHOLD) continue;
		const qty = Math.ceil(netNeed / coveragePerUnit);
		if (qty <= 0) continue;

		exactAllocations.push({
			positionId: createPositionId("exact", targetYear, exactBond.cusip),
			cusip: exactBond.cusip,
			qty,
			coverageType: "exact",
			targetYear,
		});
		applyCoverageFromBond(
			exactRequirements,
			exactBond,
			qty,
			startYear,
			endYear,
			options,
		);
	}

	trimExactOverallocation(
		exactAllocations,
		bondByCusip,
		baseRequirements,
		startYear,
		endYear,
		options,
	);

	const allocations = [...exactAllocations];
	const requirements = rebuildRequirementsFromAllocations(
		baseRequirements,
		startYear,
		endYear,
		allocations,
		bondByCusip,
		options,
	);
	const unmetIncome: Record<number, number> = {};
	const gapSegments = findGapSegments(exactYears, startYear, endYear).sort(
		(a, b) => b[0] - a[0],
	);

	for (const gapYears of gapSegments) {
		const gapPlan = findGapPlan(
			selectedBondByYear,
			gapYears,
			requirements,
			options,
		);
		if (!gapPlan) {
			for (const year of gapYears) {
				if (requirements[year] > MIN_NEED_THRESHOLD) {
					unmetIncome[year] = requirements[year];
				}
			}
			continue;
		}

		appendGapPlanAllocations(
			requirements,
			allocations,
			gapPlan,
			startYear,
			endYear,
			options,
		);
	}

	const positions = allocations
		.filter((allocation) => allocation.qty > 0)
		.map((allocation) => materializePosition(allocation, bondByCusip))
		.sort(comparePositionOrder);

	return {
		rungs: positionsToRungs(positions),
		totalCost: positions.reduce((sum, position) => sum + position.cost, 0),
		unmetIncome,
		positions,
	};
}

/**
 * Builds a TIPS ladder that funds a real annual income target across the horizon.
 */
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

/**
 * Aggregates repeated holdings by CUSIP before projecting them onto positions.
 */
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

/**
 * Infers missing exact years that should be ignored when reconstructing current positions.
 */
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

/**
 * Creates a fallback current position for holdings that do not map to a target template.
 */
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

/**
 * Converts raw current holdings into normalized position records.
 */
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

/**
 * Projects current holdings onto template positions while preserving leftover quantities.
 */
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

/**
 * Resolves the current position model used to compare holdings with the desired target.
 */
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

/**
 * Returns the unit price used to estimate a trade's cash effect.
 */
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

/**
 * Returns whether a rebalance diff is small enough to suppress as maintenance noise.
 */
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

/**
 * Builds the normalized trade record for one position delta.
 */
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

/**
 * Sorts trades by target year, action priority, and CUSIP.
 */
function sortTrades(a: Trade, b: Trade): number {
	const aYear = a.targetYear ?? Number.MAX_SAFE_INTEGER;
	const bYear = b.targetYear ?? Number.MAX_SAFE_INTEGER;
	if (aYear !== bYear) return aYear - bYear;
	const aAction = a.action === "BUY" ? 0 : a.action === "HOLD" ? 1 : 2;
	const bAction = b.action === "BUY" ? 0 : b.action === "HOLD" ? 1 : 2;
	if (aAction !== bAction) return aAction - bAction;
	return a.cusip.localeCompare(b.cusip);
}

/**
 * Groups exact-match buys with the gap-bridge sells they replace.
 */
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

/**
 * Compares current holdings to the target ladder and returns the rebalance plan.
 */
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
