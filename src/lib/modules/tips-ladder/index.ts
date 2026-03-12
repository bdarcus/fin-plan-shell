/**
 * TIPS Ladder Module
 *
 * This module is an adaptation of the TipsLadderBuilder by aerokam:
 * https://github.com/aerokam/TipsLadderBuilder
 */
import { derived, get } from "svelte/store";
import type { FinancialModule, IncomeStream } from "../../core/types";
import TipsAnalysis from "./components/TipsAnalysis.svelte";
import TipsConfig from "./components/TipsConfig.svelte";
import TipsDashboard from "./components/TipsDashboard.svelte";
// Components
import TipsIcon from "./components/TipsIcon.svelte";
import TipsImport from "./components/TipsImport.svelte";
import TipsWizard from "./components/TipsWizard.svelte";
import { type BondLadder, type LadderState, ladderStore } from "./store/ladder";

export interface TipsPublicData {
	hasLadders: boolean;
	totalIncome: number;
	startYear: number;
	endYear: number;
	ladders: BondLadder[];
}

export const TipsLadderModule: FinancialModule<
	LadderState,
	number,
	TipsPublicData
> = {
	id: "tips-ladder",
	name: "Bond Ladders",
	description:
		"Managed portfolios of individual bonds providing stable, predictable income.",
	category: "income",

	store: {
		subscribe: ladderStore.subscribe,
		save: ladderStore.save,
		load: ladderStore.load,
		reset: ladderStore.reset,
		publicData: derived(ladderStore, ($state) => {
			const totalIncome = $state.ladders.reduce(
				(sum, l) => sum + l.annualIncome,
				0,
			);
			const minYear = $state.ladders.length
				? Math.min(...$state.ladders.map((l) => l.startYear))
				: new Date().getFullYear();
			const maxYear = $state.ladders.length
				? Math.max(...$state.ladders.map((l) => l.endYear))
				: minYear + 30;

			return {
				hasLadders: $state.ladders.length > 0,
				totalIncome,
				startYear: minYear,
				endYear: maxYear,
				ladders: $state.ladders,
			};
		}),
	},

	engine: {
		calculate: (_params) => {
			const state = get(ladderStore);
			return state.ladders.reduce((sum, l) => sum + l.annualIncome, 0);
		},
		getIncomeStreams: (state): IncomeStream[] => {
			return state.ladders.map((ladder: BondLadder) => {
				const annualAmounts: Record<number, number> = {};
				for (let y = ladder.startYear; y <= ladder.endYear; y++) {
					annualAmounts[y] = ladder.annualIncome;
				}

				return {
					id: ladder.id,
					name: ladder.name,
					annualAmounts,
					isGuaranteed: true,
					hasCOLA: true,
					taxStatus: ladder.taxStatus,
				};
			});
		},
	},
	ui: {
		Icon: TipsIcon,
		Config: TipsConfig,
		Dashboard: TipsDashboard,
		Analysis: TipsAnalysis,
		Import: TipsImport,
		Wizard: TipsWizard,
	},
};
