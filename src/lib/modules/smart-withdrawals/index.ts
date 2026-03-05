import {
	runMonteCarlo,
	type SimulationResult,
} from "@fin-plan/smart-withdrawals-engine";
import { derived, get } from "svelte/store";
import { registry } from "../../core/registry.svelte";
import type {
	FinancialModule,
	IncomeStream,
	ProjectionData,
} from "../../core/types";
import { type PlanningHorizon, planningHorizon } from "../../shared/planning";
import { portfolioStore } from "../portfolio-manager/store/portfolio";
import WithdrawalAnalysis from "./components/WithdrawalAnalysis.svelte";
import WithdrawalConfig from "./components/WithdrawalConfig.svelte";
import WithdrawalDashboard from "./components/WithdrawalDashboard.svelte";
import WithdrawalIcon from "./components/WithdrawalIcon.svelte";

export interface SmartWithdrawalPublicData {
	planningHorizonYears: number;
	horizonYear: number;
}

export interface SmartWithdrawalCalcResult {
	totalSpending: number;
	monteCarlo: SimulationResult;
	yearsRemaining: number;
}

export const SmartWithdrawalModule: FinancialModule<
	PlanningHorizon,
	SmartWithdrawalCalcResult,
	SmartWithdrawalPublicData
> = {
	id: "smart-withdrawals",
	name: "Smart Withdrawal",
	description: "Monte Carlo powered dynamic spending.",
	category: "portfolio",
	store: {
		subscribe: (run: (val: PlanningHorizon) => void) =>
			planningHorizon.subscribe(run),
		save: () => {},
		load: () => {},
		reset: () => {},
		publicData: derived([planningHorizon], ([$horizon]) => ({
			planningHorizonYears: $horizon.yearsRemaining,
			horizonYear: $horizon.horizonYear,
		})),
	},
	engine: {
		calculate: (_params) => {
			const horizon = get(planningHorizon);
			const enabledModules = registry.enabledModulesList;
			const incomeStreams = enabledModules
				.filter((m) => m.category === "income")
				.flatMap((m) => {
					return m.engine.getIncomeStreams?.(get(m.store)) || [];
				});

			const portfolio = get(portfolioStore);
			const mcResults = runMonteCarlo({
				startBalance: portfolio.balance,
				equityAllocation: portfolio.equityAllocation,
				years: horizon.yearsRemaining,
				equityReturn: portfolio.marketAssumptions.equityRealReturn,
				equityVol: 0.16,
				tipsReturn: portfolio.marketAssumptions.tipsRealReturn,
				bequestTarget: portfolio.bequestTarget,
				incomeStreams,
			});
			return {
				totalSpending: mcResults.p50[0],
				monteCarlo: mcResults,
				yearsRemaining: horizon.yearsRemaining,
			};
		},
		getIncomeStreams: (_state): IncomeStream[] => [],
		project: (_state): ProjectionData => {
			const calc = SmartWithdrawalModule.engine.calculate({});
			return { years: calc.monteCarlo.years, values: calc.monteCarlo.p50 };
		},
	},
	ui: {
		Icon: WithdrawalIcon,
		Config: WithdrawalConfig,
		Dashboard: WithdrawalDashboard,
		Analysis: WithdrawalAnalysis,
	},
};
