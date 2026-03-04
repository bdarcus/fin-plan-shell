import { derived, get } from "svelte/store";
import type {
	FinancialModule,
	IncomeStream,
	ProjectionData,
} from "../../core/types";
import { planningHorizon } from "../../shared/planning";
import PensionAnalysis from "./components/PensionAnalysis.svelte";
import PensionConfig from "./components/PensionConfig.svelte";
import PensionDashboard from "./components/PensionDashboard.svelte";
import PensionIcon from "./components/PensionIcon.svelte";
import { type PensionState, pensionStore } from "./store/pension";

export const PensionModule: FinancialModule<PensionState, any, any> = {
	id: "pension",
	name: "Pension",
	description: "Fixed monthly retirement benefits.",
	category: "income",
	store: {
		subscribe: pensionStore.subscribe,
		save: pensionStore.save,
		load: pensionStore.load,
		reset: pensionStore.reset,
		publicData: derived(pensionStore, ($s) => ({ amount: $s.amount })),
	},
	engine: {
		calculate: (params) => get(pensionStore).amount,
		getIncomeStreams: (state): IncomeStream[] => {
			const annualAmounts: Record<number, number> = {};
			const start = new Date().getFullYear();
			for (let i = 0; i < 40; i++) annualAmounts[start + i] = state.amount * 12;
			return [
				{
					id: "pension",
					name: "Pension",
					annualAmounts,
					isGuaranteed: true,
					hasCOLA: state.colaType !== "None",
					taxStatus: "taxable",
				},
			];
		},
	},
	ui: {
		Icon: PensionIcon,
		Config: PensionConfig as any,
		Dashboard: PensionDashboard,
		Analysis: PensionAnalysis,
	},
};
