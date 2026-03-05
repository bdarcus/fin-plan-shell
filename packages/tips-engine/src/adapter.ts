import { type BondInfo, calculateRebalance, type Holding } from "./core";
import type { TipsMapEntry, TipsRefRow } from "./market-data";

type LegacyRow = [
	string, // 0: cusip
	number, // 1: unused
	string, // 2: maturity
	number, // 3: unused
	number, // 4: unused
	number, // 5: unused
	number, // 6: unused
	number, // 7: unused
	number, // 8: total qty
	number, // 9: action qty (+buy / -sell)
	number, // 10: clean-price cash effect
	number, // 11: adjusted-principal cash effect
	number, // 12: unused
];

const LEGACY_ROW = {
	CUSIP: 0,
	MATURITY: 2,
	QTY: 8,
	ACTION_QTY: 9,
	CLEAN_CASH_EFFECT: 10,
	ADJUSTED_CASH_EFFECT: 11,
} as const;

export interface LegacyParams {
	tipsMap?: Map<string, TipsMapEntry>;
	dara: number;
	startYear?: number;
	endYear?: number;
	holdings?: Holding[];
	refCpiRows?: TipsRefRow[]; // Added for legacy compatibility
	settlementDate?: Date;
	excludeCusips?: string[];
	strategy?: string;
	marginalTaxRate?: number;
}

export interface LegacyResult {
	summary: {
		rungCount: number;
		DARA: number;
		costDeltaSumClean: number;
		costDeltaSumAdjusted: number;
		primaryCostMode: "clean";
		costDeltaSum: number;
		inferredDARA: number;
		firstYear?: number;
		lastYear?: number;
		unmetYears?: number[];
		unmetIncomeTotal?: number;
		hasUnmetIncome?: boolean;
	};
	results: LegacyRow[];
}

/**
 * An adapter to bridge the new clean-room core engine with the legacy UI expectations.
 */
export function runRebalanceLegacyAdapter(params: LegacyParams): LegacyResult {
	// 1. Convert legacy TipsMap into BondInfo array
	const bonds: BondInfo[] = [];
	if (params.tipsMap) {
		for (const [cusip, info] of params.tipsMap.entries()) {
			bonds.push({
				cusip: cusip,
				maturity: info.maturity,
				coupon: info.coupon,
				price: (info.price ?? 100) as number,
				baseCpi: info.baseCpi,
				indexRatio: (info.indexRatio ?? 1.0) as number,
				yield: (info.yield ?? 0) as number,
			});
		}
	}
	const excludeCusips = new Set(params.excludeCusips ?? []);
	const filteredBonds = bonds.filter((bond) => !excludeCusips.has(bond.cusip));

	const dara = params.dara;
	const startYear = params.startYear || new Date().getFullYear();
	const endYear = params.endYear || startYear + 30;
	const holdings = params.holdings || [];
	const gapUpperSelectionStrategy =
		params.strategy === "Cheapest" ? "cheapest" : "nearest";
	// Accepted for compatibility with existing UI, but tax-aware pricing is not yet implemented.
	void params.marginalTaxRate;

	const rebalance = calculateRebalance(
		filteredBonds,
		holdings,
		dara,
		startYear,
		endYear,
		{
			settlementDate: params.settlementDate,
			gapUpperSelectionStrategy,
		},
	);

	// 2. Map new trades back to the weird legacy array format used by the UI
	// Legacy row: [cusip, maturity, price, yield, duration, amount, targetAmount, diff, parAmount (qty), action, actionParAmount (cost?), totalCost, totalValue]
	const bondByCusip = new Map(filteredBonds.map((bond) => [bond.cusip, bond]));
	const legacyResults: LegacyRow[] = rebalance.trades.map((trade) => {
		const bond = bondByCusip.get(trade.cusip);
		const row: LegacyRow = ["", 0, "", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
		const signedQty =
			trade.action === "BUY"
				? trade.qty
				: trade.action === "SELL"
					? -trade.qty
					: 0;
		const cleanCashEffect = bond ? signedQty * bond.price : 0;

		row[LEGACY_ROW.CUSIP] = trade.cusip;
		row[LEGACY_ROW.MATURITY] = bond ? bond.maturity : "Unknown";
		row[LEGACY_ROW.QTY] = trade.qty;
		row[LEGACY_ROW.ACTION_QTY] = signedQty;
		row[LEGACY_ROW.CLEAN_CASH_EFFECT] = cleanCashEffect;
		row[LEGACY_ROW.ADJUSTED_CASH_EFFECT] = trade.estimatedCost;

		return row;
	});
	const unmetYears = Object.keys(rebalance.unmetIncome)
		.map((year) => Number(year))
		.sort((a, b) => a - b);
	const unmetIncomeTotal = Object.values(rebalance.unmetIncome).reduce(
		(sum, amount) => sum + amount,
		0,
	);
	const costDeltaSumClean = legacyResults.reduce(
		(sum, row) => sum + row[LEGACY_ROW.CLEAN_CASH_EFFECT],
		0,
	);
	const costDeltaSumAdjusted = rebalance.totalNetCost;

	return {
		summary: {
			rungCount: rebalance.targetLadder.length,
			DARA: dara,
			costDeltaSumClean,
			costDeltaSumAdjusted,
			primaryCostMode: "clean",
			costDeltaSum: costDeltaSumAdjusted,
			inferredDARA: dara, // Simplified fallback
			firstYear: startYear,
			lastYear: endYear,
			unmetYears,
			unmetIncomeTotal,
			hasUnmetIncome: unmetYears.length > 0,
		},
		results: legacyResults,
	};
}
