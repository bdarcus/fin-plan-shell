import type {
	LegacyParams,
	LegacyResult,
	MarketData,
	Trade,
} from "@fin-plan/tips-engine";
import type { BondLadder, TipsLadderSettings } from "../store/ladder";

/**
 * Returns ladder settings with defaults applied for older saved ladders.
 */
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

/**
 * Builds the legacy maintenance request payload from a saved ladder and market snapshot.
 */
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

/**
 * Returns whether a maintenance run contains any non-hold trades.
 */
export function hasActionableTrades(result: LegacyResult): boolean {
	return result.trades.some((trade) => trade.action !== "HOLD");
}

/**
 * Hides maintenance trades that are superseded by grouped upgrade suggestions.
 */
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

/**
 * Builds the persisted ladder state after the user applies a manual maintenance run.
 */
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
