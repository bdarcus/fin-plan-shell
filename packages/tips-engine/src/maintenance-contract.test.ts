import { describe, expect, test } from "bun:test";
import type {
	LegacyResult,
	MarketData,
	TargetPosition,
	Trade,
} from "@fin-plan/tips-engine";
import {
	getDisplayedMaintenanceTrades,
	getMaintenanceParams,
	getNextManualLadderState,
	hasActionableTrades,
} from "../../../src/lib/modules/tips-ladder/lib/maintenance";
import type { BondLadder } from "../../../src/lib/modules/tips-ladder/store/ladder";

const marketData: MarketData = {
	tipsMap: new Map(),
	refCpiRows: [{ date: "2026-03-02", refCpi: 317.671 }],
	settlementDate: new Date("2026-03-02"),
	source: "local-csv",
	asOfDate: "2026-03-02",
	priceConvention: "clean",
};

const targetPositions: TargetPosition[] = [
	{
		positionId: "exact:2037:NEW-2037",
		cusip: "NEW-2037",
		maturity: "2037-02-15",
		year: 2037,
		qty: 97,
		cost: 9700,
		principal: 9700,
		couponIncome: 194,
		coverageType: "exact",
		targetYear: 2037,
	},
];

function makeTrade(
	overrides: Partial<Trade> & Pick<Trade, "positionId" | "cusip" | "action">,
): Trade {
	return {
		positionId: overrides.positionId,
		cusip: overrides.cusip,
		action: overrides.action,
		qty: overrides.qty ?? 0,
		currentQty: overrides.currentQty ?? 0,
		targetQty: overrides.targetQty ?? 0,
		estimatedPrice: overrides.estimatedPrice ?? 100,
		estimatedCost: overrides.estimatedCost ?? 0,
		intent: overrides.intent,
		gapYear: overrides.gapYear,
		targetYear: overrides.targetYear,
		bracketRole: overrides.bracketRole,
	};
}

function makeLegacyResult(overrides: Partial<LegacyResult> = {}): LegacyResult {
	return {
		summary: {
			rungCount: 0,
			DARA: 0,
			costDeltaSumClean: 0,
			costDeltaSumAdjusted: 0,
			primaryCostMode: "clean",
			costDeltaSum: 0,
			inferredDARA: 0,
			firstYear: 2032,
			lastYear: 2046,
			unmetYears: [],
			unmetIncomeTotal: 0,
			hasUnmetIncome: false,
		},
		results: [],
		trades: [],
		targetPositions: [],
		currentPositions: [],
		holdingsAfter: [],
		upgradeGroups: [],
		...overrides,
	};
}

describe("TIPS Ladder maintenance helpers", () => {
	test("getMaintenanceParams reuses saved ladder settings and target positions", () => {
		const ladder: BondLadder = {
			id: "ladder-1",
			name: "Retirement TIPS",
			type: "tips-manual",
			taxStatus: "taxable",
			holdings: [{ cusip: "OLD-2036", qty: 125 }],
			positions: targetPositions,
			settings: {
				strategy: "Cheapest",
				excludeCusips: ["EXCLUDE-ME"],
			},
			startYear: 2032,
			endYear: 2046,
			annualIncome: 60000,
		};

		const params = getMaintenanceParams(ladder, marketData);

		expect(params.dara).toBe(60000);
		expect(params.startYear).toBe(2032);
		expect(params.endYear).toBe(2046);
		expect(params.strategy).toBe("Cheapest");
		expect(params.excludeCusips).toEqual(["EXCLUDE-ME"]);
		expect(params.currentTargetPositions).toEqual(targetPositions);
		expect(params.settlementDate).toEqual(marketData.settlementDate);
	});

	test("getDisplayedMaintenanceTrades hides grouped gap-fill legs and keeps standalone maintenance trades", () => {
		const exactBuy = makeTrade({
			positionId: "exact:2037:NEW-2037",
			cusip: "NEW-2037",
			action: "BUY",
			qty: 97,
			targetQty: 97,
			estimatedCost: 9700,
			intent: "exact-match",
			targetYear: 2037,
			gapYear: 2037,
		});
		const lowerSell = makeTrade({
			positionId: "gap:2037:lower:OLD-2036",
			cusip: "OLD-2036",
			action: "SELL",
			qty: 49,
			currentQty: 49,
			estimatedCost: -4900,
			intent: "gap-bridge",
			targetYear: 2037,
			gapYear: 2037,
			bracketRole: "lower",
		});
		const upperSell = makeTrade({
			positionId: "gap:2037:upper:OLD-2040",
			cusip: "OLD-2040",
			action: "SELL",
			qty: 48,
			currentQty: 48,
			estimatedCost: -4800,
			intent: "gap-bridge",
			targetYear: 2037,
			gapYear: 2037,
			bracketRole: "upper",
		});
		const maintenanceSell = makeTrade({
			positionId: "current-extra:OLD-2049:0",
			cusip: "OLD-2049",
			action: "SELL",
			qty: 5,
			currentQty: 5,
			estimatedCost: -500,
			intent: "maintenance",
		});
		const result = makeLegacyResult({
			trades: [exactBuy, lowerSell, upperSell, maintenanceSell],
			upgradeGroups: [
				{
					targetYear: 2037,
					buy: exactBuy,
					sells: [lowerSell, upperSell],
					netCost: 0,
				},
			],
		});

		expect(hasActionableTrades(result)).toBe(true);
		expect(getDisplayedMaintenanceTrades(result)).toEqual([maintenanceSell]);
	});

	test("getNextManualLadderState stores post-trade holdings and new target positions", () => {
		const ladder: BondLadder = {
			id: "ladder-2",
			name: "Bridge Ladder",
			type: "tips-manual",
			taxStatus: "taxable",
			holdings: [{ cusip: "OLD-2036", qty: 145 }],
			positions: [],
			settings: {
				strategy: "Default",
				excludeCusips: ["SKIP-THIS"],
			},
			startYear: 2032,
			endYear: 2046,
			annualIncome: 55000,
		};
		const result = makeLegacyResult({
			holdingsAfter: [
				{ cusip: "OLD-2036", qty: 96 },
				{ cusip: "NEW-2037", qty: 97 },
			],
			targetPositions,
		});

		expect(getNextManualLadderState(ladder, result)).toEqual({
			holdings: result.holdingsAfter,
			positions: targetPositions,
			settings: ladder.settings,
		});
	});

	test("hasActionableTrades ignores hold-only results", () => {
		const holdOnly = makeLegacyResult({
			trades: [
				makeTrade({
					positionId: "exact:2038:KEEP-2038",
					cusip: "KEEP-2038",
					action: "HOLD",
					qty: 100,
					currentQty: 100,
					targetQty: 100,
				}),
			],
		});

		expect(hasActionableTrades(holdOnly)).toBe(false);
	});
});
