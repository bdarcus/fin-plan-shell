<script lang="ts">
import {
	fetchMarketData,
	getRefCpi,
	type MarketData,
	runRebalanceLegacyAdapter as runRebalance,
} from "@fin-plan/tips-engine";
import { onMount } from "svelte";
import { base } from "$app/paths";
import { toDateStr } from "../../../shared/date";

function _formatCurrency(val: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(val);
}

let state = $derived($ladderStore);
let _ladderCount = $derived(state.ladders.length);
let _totalIncome = $derived(
	state.ladders.reduce((sum, l) => sum + l.annualIncome, 0),
);

let marketData = $state<MarketData | null>(null);
let _needsRebalance = $state(false);

onMount(async () => {
	try {
		marketData = await fetchMarketData(fetch, base);
	} catch (_e) {
		// Silent fail for dashboard background check
	}
});

$effect(() => {
	if (!marketData || state.ladders.length === 0) {
		_needsRebalance = false;
		return;
	}

	try {
		const dateStr = toDateStr(marketData.settlementDate);
		const refCPI = getRefCpi(marketData.refCpiRows, dateStr);

		// Check each manual ladder for new bond opportunities
		let rebalanceDetected = false;
		for (const ladder of state.ladders) {
			if (ladder.type !== "tips-manual" || !ladder.holdings) continue;

			const res = runRebalance({
				dara: ladder.annualIncome,
				holdings: ladder.holdings,
				tipsMap: marketData.tipsMap,
				refCPI: refCPI,
				settlementDate: marketData.settlementDate,
				startYear: ladder.startYear,
				endYear: ladder.endYear,
			});

			// If any trade is a BUY for a substantial amount, alert
			const significantBuys = res.results.filter(
				(row) => (row[9] as number) > 0,
			);
			if (significantBuys.length > 0) {
				rebalanceDetected = true;
				break;
			}
		}
		_needsRebalance = rebalanceDetected;
	} catch (_e) {
		_needsRebalance = false;
	}
});
</script>

{#if ladderCount === 0}
	<div class="text-slate-400 italic text-sm">No ladders designed.</div>
{:else}
	<div class="space-y-4">
		{#if needsRebalance}
			<div class="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-2">
				<div class="flex items-center">
					<span class="text-lg mr-2">🔔</span>
					<div class="text-[10px] font-black uppercase tracking-widest text-emerald-800">New Auction/Trades</div>
				</div>
				<a href="{base}/resources" class="text-[9px] font-black uppercase tracking-widest bg-emerald-600 text-white px-2 py-1 rounded hover:bg-emerald-500 transition-colors">View</a>
			</div>
		{/if}

		<div class="flex justify-between items-end">
...

				<div class="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Ladder Income</div>
				<div class="text-2xl font-serif font-bold text-slate-900">{formatCurrency(totalIncome)} <span class="text-xs font-sans text-slate-400 font-normal">/yr</span></div>
			</div>
			<div class="text-right">
				<div class="text-[10px] font-black uppercase tracking-widest text-slate-400">Active Ladders</div>
				<div class="text-sm font-bold text-slate-700">{ladderCount} {ladderCount === 1 ? 'Source' : 'Sources'}</div>
			</div>
		</div>

		<div class="pt-3 border-t border-slate-50 space-y-2">
			{#each state.ladders.slice(0, 3) as ladder}
				<div class="flex justify-between items-center text-[10px]">
					<div class="flex items-center space-x-2">
						<div class="w-1.5 h-1.5 rounded-full {ladder.taxStatus === 'tax-free' ? 'bg-blue-400' : ladder.taxStatus === 'deferred' ? 'bg-orange-400' : 'bg-emerald-500'}"></div>
						<span class="font-bold text-slate-600 uppercase tracking-wider truncate max-w-[80px]">{ladder.name}</span>
						<span class="text-[8px] font-black px-1.5 py-0.5 rounded {ladder.taxStatus === 'tax-free' ? 'bg-blue-50 text-blue-600' : ladder.taxStatus === 'deferred' ? 'bg-orange-50 text-orange-600' : 'bg-emerald-50 text-emerald-600'}">
							{ladder.taxStatus === 'tax-free' ? 'ROTH' : ladder.taxStatus === 'deferred' ? 'IRA' : 'TAX'}
						</span>
					</div>
					<div class="flex items-center space-x-2">
						<span class="text-slate-400 font-bold">{ladder.startYear}–{ladder.endYear}</span>
						<span class="font-black text-slate-900">{formatCurrency(ladder.annualIncome)}</span>
					</div>
				</div>
			{/each}
			{#if ladderCount > 3}
				<div class="text-[9px] text-center font-black text-slate-300 uppercase tracking-widest pt-1">
					+ {ladderCount - 3} more sources
				</div>
			{/if}
		</div>
	</div>
{/if}
