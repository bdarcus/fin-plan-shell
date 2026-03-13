import type { TargetPosition } from "@fin-plan/tips-engine";
import { writable } from "svelte/store";

export type LadderType = "tips-manual" | "simple-income";

export interface TipsLadderSettings {
	strategy: "Default" | "Cheapest";
	excludeCusips: string[];
}

export interface BondLadder {
	id: string;
	name: string;
	type: LadderType;
	taxStatus: "taxable" | "tax-free" | "tax-deferred";
	positionModelVersion?: number;
	// For 'tips-manual'
	holdings?: { cusip: string; qty: number }[];
	positions?: TargetPosition[];
	settings?: TipsLadderSettings;
	// Common / For 'simple-income'
	startYear: number;
	endYear: number;
	annualIncome: number;
}

export interface LadderState {
	ladders: BondLadder[];
}

const DEFAULT_STATE: LadderState = {
	ladders: [],
};

const CURRENT_POSITION_MODEL_VERSION = 2;

/**
 * Applies ladder-store migrations and default settings to a saved ladder.
 */
function normalizeLadder(ladder: BondLadder): BondLadder {
	const previousVersion = ladder.positionModelVersion ?? 0;
	const shouldResetPositions =
		previousVersion < CURRENT_POSITION_MODEL_VERSION &&
		Array.isArray(ladder.positions) &&
		ladder.positions.length > 0;

	return {
		...ladder,
		positionModelVersion: CURRENT_POSITION_MODEL_VERSION,
		positions: shouldResetPositions ? [] : ladder.positions || [],
		settings: ladder.settings || {
			strategy: "Default",
			excludeCusips: [],
		},
	};
}

/**
 * Creates the persisted ladder store and handles legacy-state migration.
 */
function createLadderStore() {
	const { subscribe, set, update } = writable<LadderState>(DEFAULT_STATE);

	return {
		subscribe,
		set,
		update,
		addLadder: (ladder: Omit<BondLadder, "id">) => {
			const nextLadder = normalizeLadder({
				...ladder,
				id: crypto.randomUUID(),
			});
			update((state) => ({
				...state,
				ladders: [...state.ladders, nextLadder],
			}));
		},
		removeLadder: (id: string) => {
			update((state) => ({
				...state,
				ladders: state.ladders.filter((l) => l.id !== id),
			}));
		},
		updateLadder: (id: string, updates: Partial<BondLadder>) => {
			update((state) => ({
				...state,
				ladders: state.ladders.map((l) =>
					l.id === id ? normalizeLadder({ ...l, ...updates }) : l,
				),
			}));
		},
		save: (state: LadderState) => {
			const normalizedState = {
				ladders: state.ladders.map(normalizeLadder),
			};
			if (typeof localStorage !== "undefined") {
				try {
					localStorage.setItem(
						"tips_ladder_state",
						JSON.stringify(normalizedState),
					);
				} catch (e) {
					console.warn("localStorage unavailable (save):", e);
				}
			}
			set(normalizedState);
		},
		load: () => {
			if (typeof localStorage !== "undefined") {
				try {
					const saved = localStorage.getItem("tips_ladder_state");
					if (saved) {
						const parsed = JSON.parse(saved);
						// Migration for old state format (has target or holdings but no ladders array)
						if ((parsed.target || parsed.holdings) && !parsed.ladders) {
							const legacyLadder: BondLadder = {
								id: "legacy-tips",
								name: "Existing TIPS Ladder",
								type: "tips-manual",
								taxStatus: "taxable",
								positionModelVersion: CURRENT_POSITION_MODEL_VERSION,
								holdings: parsed.holdings || [],
								positions: [],
								settings: {
									strategy: "Default",
									excludeCusips: [],
								},
								startYear: parsed.target?.startYear || new Date().getFullYear(),
								endYear: parsed.target?.endYear || new Date().getFullYear() + 9,
								annualIncome: parsed.target?.income || 0,
							};
							const newState = { ladders: [normalizeLadder(legacyLadder)] };
							set(newState);
							// Save the migrated state immediately
							localStorage.setItem(
								"tips_ladder_state",
								JSON.stringify(newState),
							);
						} else {
							const normalizedState = {
								ladders: (parsed.ladders || []).map((ladder: BondLadder) =>
									normalizeLadder(ladder),
								),
							};
							set(normalizedState);
							localStorage.setItem(
								"tips_ladder_state",
								JSON.stringify(normalizedState),
							);
						}
					}
				} catch (e) {
					console.warn("localStorage unavailable (load):", e);
				}
			}
		},
		reset: () => {
			if (typeof localStorage !== "undefined") {
				try {
					localStorage.removeItem("tips_ladder_state");
				} catch (e) {
					console.warn("localStorage unavailable (reset):", e);
				}
			}
			set(DEFAULT_STATE);
		},
	};
}

export const ladderStore = createLadderStore();
