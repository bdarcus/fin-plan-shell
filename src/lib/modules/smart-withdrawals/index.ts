import { runMonteCarlo } from "@fin-plan/smart-withdrawals-engine";
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

export const SmartWithdrawalModule: FinancialModule<
	PlanningHorizon,
	// biome-ignore lint/suspicious/noExplicitAny: MC results are complex
	any,
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
					// biome-ignore lint/suspicious/noExplicitAny: dynamic module lookup
					const engine = m.engine as any;
					// biome-ignore lint/suspicious/noExplicitAny: dynamic store lookup
					const store = m.store as any;
					return engine.getIncomeStreams?.(get(store)) || [];
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
			// biome-ignore lint/suspicious/noExplicitAny: complex calc result
			const calc = SmartWithdrawalModule.engine.calculate({}) as any;
			return { years: calc.monteCarlo.years, values: calc.monteCarlo.p50 };
		},
	},
	ui: {
		Icon: WithdrawalIcon,
		// biome-ignore lint/suspicious/noExplicitAny: component props
		Config: WithdrawalConfig as any,
		Dashboard: WithdrawalDashboard,
		Analysis: WithdrawalAnalysis,
	},
};
