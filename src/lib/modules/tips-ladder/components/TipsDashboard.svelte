<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import {
		fetchMarketData,
		type MarketData,
		runRebalanceLegacyAdapter as runRebalance,
	} from "@fin-plan/tips-engine";
	import { onMount } from "svelte";
	import { base } from "$app/paths";
	import { goto } from "$app/navigation";
	import { registry } from "$lib";
	import {
		getMaintenanceParams,
		hasActionableTrades,
	} from "../lib/maintenance";
	import {
		getActiveLadderIncome,
		getActiveLadders,
	} from "../lib/active-ladders";
	import { ladderStore } from "../store/ladder";

	function formatCurrency(val: number): string {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
			maximumFractionDigits: 0,
		}).format(val);
	}

	let ladderState = $derived($ladderStore);
	let currentYear = $derived(new Date().getFullYear());
	let activeLadders = $derived(
		getActiveLadders(ladderState.ladders, currentYear),
	);
	let activeLadderCount = $derived(activeLadders.length);
	let activeTotalIncome = $derived(
		getActiveLadderIncome(ladderState.ladders, currentYear),
	);

	let marketData = $state(null) as MarketData | null;
	let needsRebalance = $state(false);

	function goToWizard() {
		registry.setActive("tips-ladder");
		goto(`${base}/wizard`);
	}

	onMount(async () => {
		try {
			marketData = await fetchMarketData(fetch, base);
		} catch {
			// Silent fail for dashboard background check
		}
	});

	$effect(() => {
		if (!marketData || ladderState.ladders.length === 0) {
			needsRebalance = false;
			return;
		}

		try {
			// Check each manual ladder for new bond opportunities
			let rebalanceDetected = false;
			for (const ladder of ladderState.ladders) {
				if (ladder.type !== "tips-manual" || !ladder.holdings) continue;

				const res = runRebalance(getMaintenanceParams(ladder, marketData));
				if (hasActionableTrades(res)) {
					rebalanceDetected = true;
					break;
				}
			}
			needsRebalance = rebalanceDetected;
		} catch {
			needsRebalance = false;
		}
	});
</script>

{#if ladderState.ladders.length === 0}
	<div class="text-slate-400 italic text-sm">No ladders designed.</div>
{:else}
	<div class="space-y-4">
		{#if needsRebalance}
			<div
				class="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-2"
			>
				<div class="flex items-center">
					<span class="text-lg mr-2">🔔</span>
					<div
						class="text-[10px] font-black uppercase tracking-widest text-emerald-800"
					>
						New Auction/Trades
					</div>
				</div>
				<button
					onclick={goToWizard}
					class="text-[9px] font-black uppercase tracking-widest bg-emerald-600 text-white px-2 py-1 rounded hover:bg-emerald-500 transition-colors cursor-pointer"
					>View</button
				>
			</div>
		{/if}

		<div class="flex justify-between items-end">
			<div>
				<div
					class="text-[10px] font-black uppercase tracking-widest text-slate-400"
				>
					Total Ladder Income
				</div>
				<div class="text-2xl font-serif font-bold text-slate-900">
					{formatCurrency(activeTotalIncome)}
					<span class="text-xs font-sans text-slate-400 font-normal">/yr</span>
				</div>
			</div>
			<div class="text-right">
				<div
					class="text-[10px] font-black uppercase tracking-widest text-slate-400"
				>
					Active Ladders
				</div>
				<div class="text-sm font-bold text-slate-700">
					{activeLadderCount}
					{activeLadderCount === 1 ? "Source" : "Sources"}
				</div>
			</div>
		</div>

		<div class="pt-3 border-t border-slate-50 space-y-2">
			{#if activeLadderCount === 0}
				<div class="text-[10px] font-bold text-slate-400 italic">
					No ladders active in {currentYear}.
				</div>
			{:else}
				{#each activeLadders.slice(0, 3) as ladder (ladder.id)}
					<div class="flex justify-between items-center text-[10px]">
						<div class="flex items-center space-x-2">
							<div
								class="w-1.5 h-1.5 rounded-full {ladder.taxStatus === 'tax-free'
									? 'bg-blue-400'
									: ladder.taxStatus === 'tax-deferred'
										? 'bg-orange-400'
										: 'bg-emerald-500'}"
							></div>
							<span
								class="font-bold text-slate-600 uppercase tracking-wider truncate max-w-[80px]"
								>{ladder.name}</span
							>
							<span
								class="text-[8px] font-black px-1.5 py-0.5 rounded {ladder.taxStatus ===
								'tax-free'
									? 'bg-blue-50 text-blue-600'
									: ladder.taxStatus === 'tax-deferred'
										? 'bg-orange-50 text-orange-600'
										: 'bg-emerald-50 text-emerald-600'}"
							>
								{ladder.taxStatus === "tax-free"
									? "ROTH"
									: ladder.taxStatus === "tax-deferred"
										? "IRA"
										: "TAX"}
							</span>
						</div>
						<div class="flex items-center space-x-2">
							<span class="text-slate-400 font-bold"
								>{ladder.startYear}–{ladder.endYear}</span
							>
							<span class="font-black text-slate-900"
								>{formatCurrency(ladder.annualIncome)}</span
							>
						</div>
					</div>
				{/each}
				{#if activeLadderCount > 3}
					<div
						class="text-[9px] text-center font-black text-slate-300 uppercase tracking-widest pt-1"
					>
						+ {activeLadderCount - 3} more sources
					</div>
				{/if}
			{/if}
		</div>
	</div>
{/if}
