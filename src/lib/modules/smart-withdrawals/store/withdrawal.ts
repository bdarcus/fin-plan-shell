import { writable } from "svelte/store";

export interface PersonInfo {
	age: number;
	gender: "male" | "female";
}

export interface WithdrawalState {
	people: PersonInfo[];
	conservatismMargin: number; // 0.0 to 1.0 (0.0 = average LE, 1.0 = extremely conservative/long life)
	targetProbOfSurvival: number; // e.g., 0.95 for 95% chance of survival
}

const DEFAULT_STATE: WithdrawalState = {
	people: [
		{ age: 65, gender: "male" },
		{ age: 65, gender: "female" },
	],
	conservatismMargin: 0.5,
	targetProbOfSurvival: 0.95,
};

/**
 * Creates the persisted smart-withdrawals input store.
 */
function createWithdrawalStore() {
	const { subscribe, set, update } = writable<WithdrawalState>(DEFAULT_STATE);

	return {
		subscribe,
		set,
		update,
		save: (state: WithdrawalState) => {
			if (typeof localStorage !== "undefined") {
				try {
					localStorage.setItem(
						"smart_withdrawals_state",
						JSON.stringify(state),
					);
				} catch (e) {
					console.warn("localStorage unavailable (save):", e);
				}
			}
			set(state);
		},
		load: () => {
			if (typeof localStorage !== "undefined") {
				try {
					const saved = localStorage.getItem("smart_withdrawals_state");
					if (saved) set(JSON.parse(saved));
				} catch (e) {
					console.warn("localStorage unavailable (load):", e);
				}
			}
		},
		reset: () => {
			if (typeof localStorage !== "undefined") {
				try {
					localStorage.removeItem("smart_withdrawals_state");
				} catch (e) {
					console.warn("localStorage unavailable (reset):", e);
				}
			}
			set(DEFAULT_STATE);
		},
	};
}

export const withdrawalStore = createWithdrawalStore();
