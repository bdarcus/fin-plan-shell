import { derived, get } from "svelte/store";
import { registry } from "../../core/registry.svelte";
import type { FinancialModule, ProjectionData } from "../../core/types";
import { planningHorizon } from "../../shared/planning";
import { portfolioStore } from "../portfolio-manager/store/portfolio";
import WithdrawalAnalysis from "./components/WithdrawalAnalysis.svelte";
import WithdrawalConfig from "./components/WithdrawalConfig.svelte";
import WithdrawalDashboard from "./components/WithdrawalDashboard.svelte";
import WithdrawalIcon from "./components/WithdrawalIcon.svelte";
import { runMonteCarlo } from "@fin-plan/smart-withdrawals-engine";

export const SmartWithdrawalModule: FinancialModule<any, any, any> = {
	id: "smart-withdrawals",
	name: "Smart Withdrawal",
	description: "Monte Carlo powered dynamic spending.",
	category: "portfolio",
	store: {
		subscribe: (run: any) => planningHorizon.subscribe(run),
		save: () => {},
		load: () => {},
		reset: () => {},
		publicData: derived([planningHorizon], ([$horizon]) => ({
			planningHorizonYears: $horizon.yearsRemaining,
			horizonYear: $horizon.horizonYear,
		})),
	},
	engine: {
		calculate: (params) => {
			const horizon = get(planningHorizon);
			const enabledModules = registry.enabledModulesList;
			const incomeStreams = enabledModules
				.filter((m) => m.category === "income")
				.flatMap((m) => m.engine.getIncomeStreams?.(get(m.store as any)) || []);
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
		getIncomeStreams: (state): any => [],
		project: (state): ProjectionData => {
			const calc = SmartWithdrawalModule.engine.calculate({});
			return { years: calc.monteCarlo.years, values: calc.monteCarlo.p50 };
		},
	},
	ui: {
		Icon: WithdrawalIcon,
		Config: WithdrawalConfig as any,
		Dashboard: WithdrawalDashboard,
		Analysis: WithdrawalAnalysis,
	},
};
