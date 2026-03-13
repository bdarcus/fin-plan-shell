import type { LegacyResult } from "@fin-plan/tips-engine";

export type LegacyRow = LegacyResult["results"][number];

const LEGACY_ROW_INDEX = {
	CUSIP: 0,
	LEGACY_QTY: 1,
	MATURITY: 2,
	DISPLAY_YEAR: 3,
	QTY: 8,
	ACTION_QTY: 9,
	CLEAN_CASH_EFFECT: 10,
	ADJUSTED_CASH_EFFECT: 11,
	INTENT: 12,
	GAP_YEAR: 13,
} as const;

/**
 * Returns the CUSIP cell from a legacy ladder table row.
 */
export function legacyRowCusip(row: LegacyRow): string {
	return row[LEGACY_ROW_INDEX.CUSIP];
}

/**
 * Returns the maturity date cell from a legacy ladder table row.
 */
export function legacyRowMaturity(row: LegacyRow): string {
	return row[LEGACY_ROW_INDEX.MATURITY];
}

/**
 * Returns the display year used by the legacy ladder table.
 */
export function legacyRowDisplayYear(row: LegacyRow): number {
	return row[LEGACY_ROW_INDEX.DISPLAY_YEAR];
}

/**
 * Returns the target quantity stored in a legacy ladder row.
 */
export function legacyRowQty(row: LegacyRow): number {
	return row[LEGACY_ROW_INDEX.QTY];
}

/**
 * Returns the best available holding quantity, falling back to the legacy slot.
 */
export function legacyRowHoldingQty(row: LegacyRow): number {
	const qty = legacyRowQty(row);
	return Number.isFinite(qty) ? qty : row[LEGACY_ROW_INDEX.LEGACY_QTY];
}

/**
 * Returns the signed trade quantity recorded for a legacy ladder row.
 */
export function legacyRowActionQty(row: LegacyRow): number {
	return row[LEGACY_ROW_INDEX.ACTION_QTY];
}

/**
 * Returns the clean-price cash effect for a legacy ladder row.
 */
export function legacyRowCleanCashEffect(row: LegacyRow): number {
	return row[LEGACY_ROW_INDEX.CLEAN_CASH_EFFECT];
}

/**
 * Returns the adjusted-principal cash effect for a legacy ladder row.
 */
export function legacyRowAdjustedCashEffect(row: LegacyRow): number {
	return row[LEGACY_ROW_INDEX.ADJUSTED_CASH_EFFECT];
}

/**
 * Returns the trade intent label attached to a legacy ladder row.
 */
export function legacyRowIntent(row: LegacyRow): string | undefined {
	return row[LEGACY_ROW_INDEX.INTENT];
}

/**
 * Returns the synthetic gap year associated with a legacy ladder row, if any.
 */
export function legacyRowGapYear(row: LegacyRow): number | undefined {
	return row[LEGACY_ROW_INDEX.GAP_YEAR];
}

/**
 * Builds a stable keyed identity for rendering legacy ladder rows.
 */
export function legacyRowKey(row: LegacyRow, index: number): string {
	return [
		legacyRowCusip(row),
		legacyRowMaturity(row),
		legacyRowIntent(row) ?? "trade",
		legacyRowGapYear(row) ?? "none",
		index,
	].join(":");
}
