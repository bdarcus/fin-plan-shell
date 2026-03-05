<script lang="ts">
import { SmartWithdrawalModule } from "../index";
import { formatCurrency } from "../../../shared/financial";

let calc = $derived(SmartWithdrawalModule.engine.calculate({}));
</script>

<div class="space-y-8">
	<header>
		<h1 class="font-serif text-4xl font-bold text-slate-900">Withdrawal Analysis</h1>
		<p class="text-slate-500 mt-2">Dynamic spending simulation across 1,000 market scenarios.</p>
	</header>

	{#if calc}
	<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
		<div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
			<div class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Income Resilience</div>
			<div class="font-serif text-3xl font-bold {calc.monteCarlo.successRate > 90 ? "text-emerald-600" : "text-amber-600"}">
				{calc.monteCarlo.successRate.toFixed(1)}%
			</div>
			<p class="text-[10px] text-slate-400 mt-2">Probability of maintaining >80% of target income.</p>
		</div>
		<div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
			<div class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Median Real Income</div>
			<div class="font-serif text-3xl font-bold text-slate-900">
				{formatCurrency(calc.monteCarlo.p50[0] / 12)} <span class="text-xs font-sans text-slate-400">/mo</span>
			</div>
			<p class="text-[10px] text-slate-400 mt-2">Average monthly real spending power.</p>
		</div>
		<div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
			<div class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Worst Case (P5)</div>
			<div class="font-serif text-3xl font-bold text-rose-600">
				{formatCurrency(calc.monteCarlo.p5[0] / 12)} <span class="text-xs font-sans text-slate-400">/mo</span>
			</div>
			<p class="text-[10px] text-slate-400 mt-2">Estimated floor in poor market scenarios.</p>
		</div>
	</div>

	<div class="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
		<div class="flex justify-between items-center mb-12">
			<h3 class="font-serif text-xl font-bold">Income Volatility (Monte Carlo)</h3>
			<div class="flex gap-6 text-[10px] font-black uppercase tracking-widest text-slate-400">
				<div class="flex items-center"><span class="w-3 h-3 bg-emerald-500/10 rounded mr-2"></span> 90% Confidence Band</div>
				<div class="flex items-center"><span class="w-3 h-0.5 bg-emerald-600 rounded mr-2"></span> Median Projection</div>
			</div>
		</div>

		<div class="relative h-80 flex items-end gap-1 border-b border-slate-100 pb-2">
			{#each calc.monteCarlo.years as year, i}
				{@const maxVal = Math.max(...calc.monteCarlo.p95) * 1.1}
				<div class="flex-1 flex flex-col items-center group relative h-full justify-end">
					<div 
						class="absolute bg-emerald-500/10 w-full z-0" 
						style="bottom: {(calc.monteCarlo.p5[i] / maxVal) * 100}%; height: {((calc.monteCarlo.p95[i] - calc.monteCarlo.p5[i]) / maxVal) * 100}%"
					></div>
					
					<div 
						class="absolute bg-emerald-600 w-full h-0.5 z-10" 
						style="bottom: {(calc.monteCarlo.p50[i] / maxVal) * 100}%"
					>
						<div class="absolute -top-10 left-1/2 -translate-x-1/2 hidden group-hover:block bg-slate-900 text-white p-2 rounded text-[10px] whitespace-nowrap z-50">
							{year}: {formatCurrency(calc.monteCarlo.p50[i])} (Median)
						</div>
					</div>

					<div class="absolute -bottom-8 text-[9px] font-black text-slate-400">
						{year % 5 === 0 ? year : ""}
					</div>
				</div>
			{/each}
		</div>
	</div>
	{/if}
</div>
