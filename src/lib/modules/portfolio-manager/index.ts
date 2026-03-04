import { derived, get } from "svelte/store";
import type {
	FinancialModule,
	IncomeStream,
	ProjectionData,
} from "../../core/types";
import { planningHorizon } from "../../shared/planning";
import PortfolioAnalysis from "./components/PortfolioAnalysis.svelte";
import PortfolioConfig from "./components/PortfolioConfig.svelte";
import PortfolioDashboard from "./components/PortfolioDashboard.svelte";
import PortfolioIcon from "./components/PortfolioIcon.svelte";
import {
	calculateConstantAmortization,
	projectPortfolio,
} from "@fin-plan/portfolio-engine";
import {
	expectedRealReturn,
	expectedRealYield,
	type PortfolioState,
	portfolioStore,
} from "./store/portfolio";

export const TotalPortfolioModule: FinancialModule = {
	id: "portfolio-manager",
	name: "Total Portfolio",
	description: "Merton-inspired dynamic amortization.",
	category: "portfolio",
	store: {
		subscribe: portfolioStore.subscribe,
		save: portfolioStore.save,
		load: portfolioStore.load,
		reset: portfolioStore.reset,
		publicData: derived(
			[portfolioStore, expectedRealReturn, expectedRealYield],
			([$state, $realReturn, $realYield]) => ({
				totalBalance: $state.balance,
				equityAllocation: $state.equityAllocation,
				expectedRealReturn: $realReturn,
				expectedRealYield: $realYield,
			}),
		),
	},
	engine: {
		calculate: (params) => {
			const realRate = get(expectedRealReturn);
			const realYield = get(expectedRealYield);
			const state = get(portfolioStore);
			const horizon = get(planningHorizon);
			const years = Math.max(1, horizon.horizonYear - new Date().getFullYear());
			const income = calculateConstantAmortization(
				state.balance,
				realRate,
				years,
				state.bequestTarget,
			);
			return {
				amortizationIncome: income,
				passiveIncome: state.balance * realYield,
				horizonYear: horizon.horizonYear,
			};
		},
		getIncomeStreams: (state): IncomeStream[] => {
			const realRate = get(expectedRealReturn);
			const horizon = get(planningHorizon);
			const years = Math.max(1, horizon.horizonYear - new Date().getFullYear());
			const income = calculateConstantAmortization(
				state.balance,
				realRate,
				years,
				state.bequestTarget,
			);
			const annualAmounts: Record<number, number> = {};
			const start = new Date().getFullYear();
			for (let i = 0; i <= years; i++) annualAmounts[start + i] = income;
			return [
				{
					id: "portfolio-manager",
					name: "Portfolio Withdrawal",
					annualAmounts,
					isGuaranteed: false,
					hasCOLA: true,
					taxStatus: "taxable",
				},
			];
		},
		project: (state): ProjectionData => {
			const realRate = get(expectedRealReturn);
			const horizon = get(planningHorizon);
			const years = Math.max(1, horizon.horizonYear - new Date().getFullYear());
			const income = calculateConstantAmortization(
				state.balance,
				realRate,
				years,
				state.bequestTarget,
			);
			const values = projectPortfolio(state.balance, realRate, years, income);
			return {
				years: Array.from(
					{ length: values.length },
					(_, i) => new Date().getFullYear() + i,
				),
				values,
			};
		},
	},
	ui: {
		Icon: PortfolioIcon,
		Config: PortfolioConfig as any,
		Dashboard: PortfolioDashboard,
		Analysis: PortfolioAnalysis,
	},
};
