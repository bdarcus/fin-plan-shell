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

export function legacyRowCusip(row: LegacyRow): string {
	return row[LEGACY_ROW_INDEX.CUSIP];
}

export function legacyRowMaturity(row: LegacyRow): string {
	return row[LEGACY_ROW_INDEX.MATURITY];
}

export function legacyRowDisplayYear(row: LegacyRow): number {
	return row[LEGACY_ROW_INDEX.DISPLAY_YEAR];
}

export function legacyRowQty(row: LegacyRow): number {
	return row[LEGACY_ROW_INDEX.QTY];
}

export function legacyRowHoldingQty(row: LegacyRow): number {
	const qty = legacyRowQty(row);
	return Number.isFinite(qty) ? qty : row[LEGACY_ROW_INDEX.LEGACY_QTY];
}

export function legacyRowActionQty(row: LegacyRow): number {
	return row[LEGACY_ROW_INDEX.ACTION_QTY];
}

export function legacyRowCleanCashEffect(row: LegacyRow): number {
	return row[LEGACY_ROW_INDEX.CLEAN_CASH_EFFECT];
}

export function legacyRowAdjustedCashEffect(row: LegacyRow): number {
	return row[LEGACY_ROW_INDEX.ADJUSTED_CASH_EFFECT];
}

export function legacyRowIntent(row: LegacyRow): string | undefined {
	return row[LEGACY_ROW_INDEX.INTENT];
}

export function legacyRowGapYear(row: LegacyRow): number | undefined {
	return row[LEGACY_ROW_INDEX.GAP_YEAR];
}

export function legacyRowKey(row: LegacyRow, index: number): string {
	return [
		legacyRowCusip(row),
		legacyRowMaturity(row),
		legacyRowIntent(row) ?? "trade",
		legacyRowGapYear(row) ?? "none",
		index,
	].join(":");
}
