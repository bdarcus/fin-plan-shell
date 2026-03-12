<script lang="ts">
	import {
		fetchMarketData,
		type LegacyResult,
		type MarketData,
		runRebalanceLegacyAdapter as runRebalance,
	} from "@fin-plan/tips-engine";
	import { onMount } from "svelte";
	import { get } from "svelte/store";
	import { base } from "$app/paths";
	import { formatCurrency } from "../../../shared/financial";
	import {
		getDisplayedMaintenanceTrades,
		getMaintenanceParams,
		getNextManualLadderState,
		hasActionableTrades,
	} from "../lib/maintenance";
	import { ladderStore } from "../store/ladder";

	let marketData = $state<MarketData | null>(null);
	let _error = $state<string | null>(null);
	let isLoading = $state(true);

	// Results for each manual ladder
	let rebalanceResults = $state<Record<string, LegacyResult>>({});

	onMount(async () => {
		ladderStore.load();
		try {
			marketData = await fetchMarketData(fetch, base);
			calculateAllRebalances();
		} catch {
			_error = "Failed to load market data.";
		} finally {
			isLoading = false;
		}
	});

	function calculateAllRebalances() {
		if (!marketData) return;
		const results: Record<string, LegacyResult> = {};
		for (const ladder of $ladderStore.ladders) {
			if (ladder.type !== "tips-manual" || !ladder.holdings) continue;

			try {
				const res = runRebalance(getMaintenanceParams(ladder, marketData));
				results[ladder.id] = res;
			} catch (e) {
				console.error(`Rebalance failed for ladder ${ladder.name}:`, e);
			}
		}
		rebalanceResults = results;
	}

	function applyRebalance(ladderId: string) {
		const res = rebalanceResults[ladderId];
		if (!res) return;

		const ladder = $ladderStore.ladders.find((l) => l.id === ladderId);
		if (!ladder) return;

		ladderStore.updateLadder(ladderId, getNextManualLadderState(ladder, res));
		ladderStore.save(get(ladderStore));
		calculateAllRebalances();
	}

	let laddersWithTrades = $derived(
		Object.entries(rebalanceResults).filter(([_, res]) =>
			hasActionableTrades(res),
		),
	);

	function getTradeMaturity(res: LegacyResult, positionId: string): string {
		const position = [...res.targetPositions, ...res.currentPositions].find(
			(p) => p.positionId === positionId,
		);
		return position?.maturity ?? "Unknown";
	}
</script>

<div class="space-y-8 max-w-5xl mx-auto pb-20">
	<header class="text-center space-y-2">
		<h2 class="font-serif text-4xl font-bold text-slate-900">
			Ladder Maintenance Wizard
		</h2>
		<p class="text-slate-500 max-w-2xl mx-auto">
			Automatically identify opportunities to improve your TIPS ladders by
			swapping synthetic gap rungs for newly available exact maturity bonds.
		</p>
	</header>

	{#if isLoading}
		<div class="py-20 text-center text-slate-400 italic">
			Fetching latest market data and analyzing portfolios...
		</div>
	{:else if _error}
		<div
			class="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-rose-800"
		>
			{_error}
		</div>
	{:else if laddersWithTrades.length === 0}
		<div
			class="bg-white rounded-3xl border border-slate-200 p-16 text-center shadow-sm"
		>
			<div class="text-5xl mb-6">✅</div>
			<h3 class="font-serif text-2xl font-bold text-slate-900">
				All Ladders Optimized
			</h3>
			<p class="text-slate-500 mt-2 max-w-sm mx-auto">
				No new bond opportunities or rebalancing trades were identified for your
				current portfolios.
			</p>
		</div>
	{:else}
		<div class="space-y-12">
			{#each laddersWithTrades as [id, res] (id)}
				{@const ladder = $ladderStore.ladders.find((l) => l.id === id)}
				{@const upgrades = res.upgradeGroups}
				{@const maintenance = getDisplayedMaintenanceTrades(res)}

				{#if ladder}
					<section
						class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4"
					>
						<div
							class="p-8 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
						>
							<div>
								<div
									class="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1"
								>
									Maintenance Available
								</div>
								<h3 class="font-serif text-3xl font-bold text-slate-900">
									{ladder.name}
								</h3>
							</div>

							<div class="flex flex-col items-end">
								<div
									class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1"
								>
									Net Cost to Execute
								</div>
								<div
									class="text-2xl font-serif font-bold {res.summary
										.costDeltaSum >= 0
										? 'text-emerald-600'
										: 'text-rose-600'}"
								>
									{res.summary.costDeltaSum >= 0 ? "+" : ""}{formatCurrency(
										res.summary.costDeltaSum,
									)}
								</div>
							</div>
						</div>

						<div class="p-8 space-y-10">
							<!-- 1. Exact Match Upgrades (Gap Filling) -->
							{#if upgrades.length > 0}
								<div class="space-y-6">
									<div class="flex items-center gap-3">
										<span class="text-2xl">🎯</span>
										<h4 class="font-serif text-xl font-bold text-slate-900">
											Bridge the Gaps
										</h4>
									</div>
									<p class="text-sm text-slate-500 leading-relaxed max-w-3xl">
										We found new exact-maturity bonds for years that were
										previously unfunded. By purchasing these, you can reduce the
										"overbought" quantities of other bonds currently serving as
										synthetic gap pairs.
									</p>

									<div class="grid grid-cols-1 gap-4">
										{#each upgrades as upgrade (upgrade.targetYear)}
											<div
												class="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-6"
											>
												<div class="flex flex-col md:flex-row gap-8">
													<div class="flex-1 space-y-4">
														<div
															class="text-[10px] font-black uppercase tracking-widest text-emerald-700"
														>
															Income for Year {upgrade.targetYear}
														</div>
														<div class="flex items-center justify-between">
															<div class="space-y-1">
																<div class="font-bold text-slate-900">
																	BUY {upgrade.buy.cusip}
																</div>
																<div class="text-xs text-slate-500">
																	Matures {getTradeMaturity(
																		res,
																		upgrade.buy.positionId,
																	)}
																</div>
															</div>
															<div
																class="text-lg font-serif font-bold text-emerald-600"
															>
																+{upgrade.buy.qty.toLocaleString()} units
															</div>
														</div>
													</div>

													<div
														class="hidden md:flex items-center text-slate-300"
													>
														→
													</div>

													<div class="flex-1 space-y-4">
														<div
															class="text-[10px] font-black uppercase tracking-widest text-slate-400"
														>
															Replaces Synthetic Rung
														</div>
														<div class="space-y-3">
															{#each upgrade.sells as sell (sell.positionId)}
																<div class="flex items-center justify-between">
																	<div class="space-y-1">
																		<div
																			class="text-sm font-medium text-slate-700"
																		>
																			SELL {sell.cusip}
																		</div>
																		<div class="text-[10px] text-slate-500">
																			Matures {getTradeMaturity(
																				res,
																				sell.positionId,
																			)}
																		</div>
																	</div>
																	<div class="text-sm font-bold text-rose-600">
																		{sell.qty.toLocaleString()} units
																	</div>
																</div>
															{/each}
														</div>
													</div>
												</div>
											</div>
										{/each}
									</div>
								</div>
							{/if}

							<!-- 2. Maintenance Trades -->
							{#if maintenance.length > 0}
								<div class="space-y-6">
									<div class="flex items-center gap-3">
										<span class="text-2xl">⚖️</span>
										<h4 class="font-serif text-xl font-bold text-slate-900">
											Portfolio Maintenance
										</h4>
									</div>
									<p class="text-sm text-slate-500 leading-relaxed max-w-3xl">
										Routine adjustments to maintain your target real income and
										duration matching based on updated market pricing and
										inflation data.
									</p>

									<div
										class="border border-slate-100 rounded-2xl overflow-hidden"
									>
										<table class="w-full text-left text-sm">
											<thead
												class="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400"
											>
												<tr>
													<th class="px-6 py-4">Security</th>
													<th class="px-6 py-4">Action</th>
													<th class="px-4 py-3 text-right">Cash Effect</th>
												</tr>
											</thead>
											<tbody class="divide-y divide-slate-100">
												{#each maintenance as trade (trade.positionId)}
													<tr class="hover:bg-slate-50/50 transition-colors">
														<td class="px-6 py-4">
															<div class="font-bold text-slate-900">
																{trade.cusip}
															</div>
															<div class="text-[10px] text-slate-500">
																Matures {getTradeMaturity(
																	res,
																	trade.positionId,
																)}
															</div>
														</td>
														<td class="px-6 py-4">
															<span
																class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black tracking-widest {trade.action ===
																'BUY'
																	? 'bg-emerald-50 text-emerald-700'
																	: 'bg-rose-50 text-rose-700'}"
															>
																{trade.action}
																{trade.qty.toLocaleString()}
															</span>
														</td>
														<td
															class="px-6 py-4 text-right font-serif font-bold {trade.estimatedCost >=
															0
																? 'text-emerald-600'
																: 'text-rose-600'}"
														>
															{trade.estimatedCost >= 0
																? "+"
																: ""}{formatCurrency(trade.estimatedCost)}
														</td>
													</tr>
												{/each}
											</tbody>
										</table>
									</div>
								</div>
							{/if}

							<!-- Instructions -->
							<div
								class="bg-slate-900 text-white p-8 rounded-3xl flex flex-col md:flex-row justify-between items-center gap-8"
							>
								<div class="space-y-2">
									<h4 class="font-serif text-2xl font-bold">Ready to sync?</h4>
									<p class="text-slate-400 text-sm max-w-md leading-relaxed">
										Execute the trades above in your brokerage account, then
										click below to update your digital tracker.
									</p>
								</div>
								<button
									onclick={() => applyRebalance(id)}
									class="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold rounded-2xl shadow-xl transition-all whitespace-nowrap"
								>
									Commit Trades to Tracker
								</button>
							</div>
						</div>
					</section>
				{/if}
			{/each}
		</div>
	{/if}
</div>
