import type {
	LegacyParams,
	LegacyResult,
	MarketData,
	Trade,
} from "@fin-plan/tips-engine";
import type { BondLadder, TipsLadderSettings } from "../store/ladder";

export function getLadderSettings(
	ladder: Pick<BondLadder, "settings">,
): TipsLadderSettings {
	return (
		ladder.settings || {
			strategy: "Default",
			excludeCusips: [],
		}
	);
}

export function getMaintenanceParams(
	ladder: BondLadder,
	marketData: MarketData,
): LegacyParams {
	const settings = getLadderSettings(ladder);
	return {
		dara: ladder.annualIncome,
		holdings: ladder.holdings || [],
		tipsMap: marketData.tipsMap,
		refCpiRows: marketData.refCpiRows,
		settlementDate: marketData.settlementDate,
		startYear: ladder.startYear,
		endYear: ladder.endYear,
		strategy: settings.strategy,
		excludeCusips: settings.excludeCusips,
		currentTargetPositions: ladder.positions || [],
	};
}

export function hasActionableTrades(result: LegacyResult): boolean {
	return result.trades.some((trade) => trade.action !== "HOLD");
}

export function getDisplayedMaintenanceTrades(result: LegacyResult): Trade[] {
	const upgradedYears = new Set(
		result.upgradeGroups.map((group) => group.targetYear),
	);
	return result.trades.filter((trade) => {
		if (trade.action === "HOLD") return false;
		if (
			trade.intent === "gap-bridge" &&
			upgradedYears.has(trade.targetYear ?? -1)
		) {
			return false;
		}
		if (
			trade.intent === "exact-match" &&
			upgradedYears.has(trade.targetYear ?? -1)
		) {
			return false;
		}
		return true;
	});
}

export function getNextManualLadderState(
	ladder: BondLadder,
	result: LegacyResult,
): Partial<BondLadder> {
	return {
		holdings: result.holdingsAfter,
		positions: result.targetPositions,
		settings: getLadderSettings(ladder),
	};
}
