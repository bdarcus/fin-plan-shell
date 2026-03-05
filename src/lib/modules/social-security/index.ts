import { derived, get } from "svelte/store";
import type { FinancialModule, IncomeStream } from "../../core/types";
import { planningStore } from "../../shared/planning";
import SSAnalysis from "./components/SSAnalysis.svelte";
import SSConfig from "./components/SSConfig.svelte";
import SSDashboard from "./components/SSDashboard.svelte";
import SSIcon from "./components/SSIcon.svelte";
import { type SSState, ssStore } from "./store/ss";

export interface SSCalcResult {
	annualBenefit: number;
	startYear: number;
}

export interface SSPublicData {
	annualBenefit: number;
}

export const SocialSecurityModule: FinancialModule<
	SSState,
	SSCalcResult,
	SSPublicData
> = {
	id: "social-security",
	name: "Social Security",
	description: "Estimated lifetime inflation-protected benefits.",
	category: "income",
	store: {
		subscribe: ssStore.subscribe,
		save: ssStore.save,
		load: ssStore.load,
		reset: ssStore.reset,
		publicData: derived(ssStore, ($s) => ({ annualBenefit: $s.annualBenefit })),
	},
	engine: {
		calculate: (_params) => {
			const state = get(ssStore);
			const planning = get(planningStore);
			const firstPerson = planning.people[0];
			const yearsUntilClaim = firstPerson
				? state.claimingAge - firstPerson.age
				: 0;
			const startYear = new Date().getFullYear() + Math.max(0, yearsUntilClaim);

			return {
				annualBenefit: state.annualBenefit,
				startYear,
			};
		},
		getIncomeStreams: (state): IncomeStream[] => {
			const planning = get(planningStore);
			const firstPerson = planning.people[0];
			const yearsUntilClaim = firstPerson
				? state.claimingAge - firstPerson.age
				: 0;
			const currentYear = new Date().getFullYear();
			const startYear = currentYear + Math.max(0, yearsUntilClaim);
			const annualAmounts: Record<number, number> = {};

			for (let i = 0; i < 40; i++) {
				const year = currentYear + i;
				if (year >= startYear) {
					annualAmounts[year] = state.annualBenefit;
				} else {
					annualAmounts[year] = 0;
				}
			}
			return [
				{
					id: "social-security",
					name: "Social Security",
					annualAmounts,
					isGuaranteed: true,
					hasCOLA: true,
					taxStatus: "taxable",
				},
			];
		},
	},
	ui: {
		Icon: SSIcon as any,
		Config: SSConfig as any,
		Dashboard: SSDashboard as any,
		Analysis: SSAnalysis as any,
	},
};
