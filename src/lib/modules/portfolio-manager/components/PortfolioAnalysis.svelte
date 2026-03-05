<script lang="ts">
	import { registry } from "../../../core/registry.svelte";
	import { formatCurrency } from "../../../shared/financial";
	import { SmartWithdrawalModule } from "../../smart-withdrawals";
	import { TotalPortfolioModule } from "../index";
	import { portfolioStore } from "../store/portfolio";

	let portfolioData = $derived($portfolioStore);

	// Portfolio projection (deterministic based on current module engine)
	let portfolioProjectData = $derived.by(() => {
		const mod = registry.getModule(
			"portfolio-manager",
		) as typeof TotalPortfolioModule;
		if (!mod || !mod.engine.project) return { years: [], values: [] };
		return mod.engine.project(portfolioData);
	});

	// Spending projection (Monte Carlo from smart-withdrawals)
	let spendingCalc = $derived.by(() => {
		const mod = registry.getModule(
			"smart-withdrawals",
		) as typeof SmartWithdrawalModule;
		if (!mod || !registry.isEnabled("smart-withdrawals")) return null;
		return mod.engine.calculate({});
	});

	let view: "spending" | "portfolio" = $state("spending");
</script>

<div class="space-y-8">
	<div class="flex justify-between items-center">
		<h2 class="font-serif text-2xl font-bold text-slate-900">Projections</h2>
		<div class="flex bg-slate-100 p-1 rounded-xl">
			<button
				onclick={() => (view = "spending")}
				class="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all {view ===
				'spending'
					? 'bg-white text-slate-900 shadow-sm'
					: 'text-slate-500 hover:text-slate-700'}"
			>
				Spending
			</button>
			<button
				onclick={() => (view = "portfolio")}
				class="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all {view ===
				'portfolio'
					? 'bg-white text-slate-900 shadow-sm'
					: 'text-slate-500 hover:text-slate-700'}"
			>
				Portfolio
			</button>
		</div>
	</div>

	{#if view === "spending"}
		<div class="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
			{#if spendingCalc}
				<div class="flex justify-between items-center mb-12">
					<div>
						<h3 class="font-serif text-xl font-bold">Real Annual Spending</h3>
						<p class="text-slate-500 text-sm mt-1">
							Simulated across 1,000 market scenarios.
						</p>
					</div>
					<div
						class="flex gap-6 text-[10px] font-black uppercase tracking-widest text-slate-400"
					>
						<div class="flex items-center">
							<span class="w-3 h-3 bg-emerald-500/10 rounded mr-2"></span> 90% Confidence
						</div>
						<div class="flex items-center">
							<span class="w-3 h-0.5 bg-emerald-600 rounded mr-2"></span> Median
						</div>
					</div>
				</div>

				<div
					class="relative h-64 flex items-end gap-1 border-b border-slate-100 pb-2"
				>
					{#each spendingCalc.monteCarlo.years as year, i (year)}
						{@const maxVal = Math.max(...spendingCalc.monteCarlo.p95) * 1.1}
						<div
							class="flex-1 flex flex-col items-center group relative h-full justify-end"
						>
							<div
								class="absolute bg-emerald-500/10 w-full z-0"
								style="bottom: {(spendingCalc.monteCarlo.p5[i] / maxVal) *
									100}%; height: {((spendingCalc.monteCarlo.p95[i] -
									spendingCalc.monteCarlo.p5[i]) /
									maxVal) *
									100}%"
							></div>

							<div
								class="absolute bg-emerald-600 w-full h-0.5 z-10"
								style="bottom: {(spendingCalc.monteCarlo.p50[i] / maxVal) *
									100}%"
							>
								<div
									class="absolute -top-10 left-1/2 -translate-x-1/2 hidden group-hover:block bg-slate-900 text-white p-2 rounded text-[10px] whitespace-nowrap z-50"
								>
									{year}: {formatCurrency(spendingCalc.monteCarlo.p50[i])}
								</div>
							</div>

							{#if i % 5 === 0}
								<div
									class="absolute -bottom-8 text-[9px] font-black text-slate-400"
								>
									{year}
								</div>
							{/if}
						</div>
					{/each}
				</div>
				<div class="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
					<div>
						<div
							class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1"
						>
							Success Rate
						</div>
						<div class="text-xl font-bold text-emerald-600">
							{spendingCalc.monteCarlo.successRate.toFixed(1)}%
						</div>
					</div>
					<div>
						<div
							class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1"
						>
							Median Floor
						</div>
						<div class="text-xl font-bold text-slate-900">
							{formatCurrency(
								spendingCalc.monteCarlo.p50[
									spendingCalc.monteCarlo.p50.length - 1
								] / 12,
							)}/mo
						</div>
					</div>
					<div>
						<div
							class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1"
						>
							Worst Case Floor
						</div>
						<div class="text-xl font-bold text-rose-600">
							{formatCurrency(
								spendingCalc.monteCarlo.p5[
									spendingCalc.monteCarlo.p5.length - 1
								] / 12,
							)}/mo
						</div>
					</div>
				</div>
			{:else}
				<div class="py-12 text-center">
					<p class="text-slate-500">
						Enable the Smart Withdrawal module to see spending projections.
					</p>
				</div>
			{/if}
		</div>
	{:else}
		<div class="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
			<div class="mb-12">
				<h3 class="font-serif text-xl font-bold">Portfolio Value</h3>
				<p class="text-slate-500 text-sm mt-1">
					Deterministic projection based on expected real returns.
				</p>
			</div>

			<div class="h-64 flex items-end gap-1 border-b border-slate-100 pb-2">
				{#each portfolioProjectData.values as val, i (portfolioProjectData.years[i])}
					{@const maxVal = Math.max(...portfolioProjectData.values) || 1}
					<div
						class="flex-1 bg-blue-500/20 hover:bg-blue-500 transition-colors rounded-t-sm group relative"
						style="height: {(val / maxVal) * 100}%"
					>
						<div
							class="absolute -top-10 left-1/2 -translate-x-1/2 hidden group-hover:block bg-slate-900 text-white p-2 rounded text-[10px] whitespace-nowrap z-50"
						>
							{portfolioProjectData.years[i]}: {formatCurrency(val)}
						</div>
						{#if i % 5 === 0}
							<div
								class="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[9px] font-black text-slate-400"
							>
								{portfolioProjectData.years[i]}
							</div>
						{/if}
					</div>
				{/each}
			</div>
			<div class="mt-12 text-xs text-slate-400 italic">
				* This view assumes constant real returns and level amortization. Use
				Smart Withdrawal analysis for market risk scenarios.
			</div>
		</div>
	{/if}
</div>
