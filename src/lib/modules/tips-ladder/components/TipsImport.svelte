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
	import { parseHoldingsCsv } from "../../../shared/csv";
	import {
		legacyRowActionQty,
		legacyRowAdjustedCashEffect,
		legacyRowCleanCashEffect,
		legacyRowCusip,
		legacyRowKey,
		legacyRowMaturity,
	} from "../lib/legacy-row";
	import { ladderStore } from "../store/ladder";

	type Holding = { cusip: string; qty: number };

	let marketData = $state<MarketData | null>(null);
	let holdings = $state<Holding[]>([]);
	let income = $state<number | null>(null);
	let results = $state<LegacyResult | null>(null);
	let _error = $state<string | null>(null);
	let fileName = $state("");

	// Target for rebalance
	let targetLadderId = $state<string | null>(null);
	let newLadderName = $state("Imported Portfolio");

	onMount(async () => {
		ladderStore.load();
		try {
			marketData = await fetchMarketData(fetch, base);
		} catch {
			_error = "Failed to load market data.";
		}
	});

	async function handleUpload(e: Event) {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;
		fileName = file.name;
		const text = await file.text();
		holdings = parseHoldingsCsv(text);
		if (holdings.length === 0) {
			_error = "No valid holdings found in CSV (expected: CUSIP, Quantity).";
		} else {
			_error = null;
		}
	}

	function rebalance() {
		if (!marketData || holdings.length === 0) return;
		try {
			_error = null;
			results = runRebalance({
				dara: income || 0,
				holdings,
				tipsMap: marketData.tipsMap,
				refCpiRows: marketData.refCpiRows,
				settlementDate: marketData.settlementDate,
			});

			// Update or Create ladder in store
			const ladderData = {
				name: targetLadderId
					? $ladderStore.ladders.find((l) => l.id === targetLadderId)?.name ||
						newLadderName
					: newLadderName,
				type: "tips-manual" as const,
				holdings: results.holdingsAfter,
				positions: results.targetPositions,
				settings: targetLadderId
					? ($ladderStore.ladders.find((l) => l.id === targetLadderId)
							?.settings ?? {
							strategy: "Default" as const,
							excludeCusips: [],
						})
					: {
							strategy: "Default" as const,
							excludeCusips: [],
						},
				startYear: results.summary.firstYear || new Date().getFullYear(),
				endYear: results.summary.lastYear || new Date().getFullYear() + 9,

				taxStatus: "taxable" as const,
				annualIncome: results.summary.DARA,
			};

			if (targetLadderId) {
				ladderStore.updateLadder(targetLadderId, ladderData);
			} else {
				ladderStore.addLadder(ladderData);
			}

			ladderStore.save(get(ladderStore));
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			_error = message;
		}
	}
</script>

<div class="space-y-8">
	{#if holdings.length === 0}
		<div
			class="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500"
		>
			<h2 class="font-serif text-3xl font-bold mb-4">Portfolio Maintenance</h2>
			<p class="text-slate-500 mb-8">
				Upload current holdings to sync a ladder's tracking or create a new one
				from an existing portfolio.
			</p>

			<div
				class="mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-100 inline-block text-left mx-auto"
			>
				<div
					class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 text-center"
				>
					Required CSV Format
				</div>
				<code
					class="text-xs font-mono text-slate-600 block bg-white p-3 rounded-lg border border-slate-200"
				>
					cusip,qty<br />
					91282CDX6,15000<br />
					91282CGK1,10000
				</code>
			</div>

			<label class="block">
				<span class="sr-only">Choose CSV</span>
				<input
					type="file"
					accept=".csv"
					onchange={handleUpload}
					class="block w-full text-sm text-slate-500 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
				/>
			</label>
		</div>
	{:else}
		<div
			class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
		>
			<div class="flex items-center">
				<div
					class="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-2xl mr-4"
				>
					📄
				</div>
				<div>
					<h2 class="font-serif text-xl font-bold text-slate-900">
						{fileName}
					</h2>
					<p
						class="text-xs font-bold text-emerald-600 uppercase tracking-widest"
					>
						{holdings.length} Securities Identified
					</p>
				</div>
			</div>
			<button
				onclick={() => {
					holdings = [];
					results = null;
					fileName = "";
				}}
				class="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-600 transition-colors"
			>
				Change Portfolio
			</button>
		</div>
	{/if}

	{#if holdings.length > 0}
		<div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
			<aside
				class="lg:col-span-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6"
			>
				<h3
					class="font-serif text-2xl font-bold text-slate-900 border-b border-slate-100 pb-4"
				>
					Import Settings
				</h3>

				<div class="space-y-4">
					<div class="space-y-2">
						<label
							for="dest-select"
							class="block text-[10px] font-black uppercase tracking-wider text-slate-500"
							>Destination</label
						>
						<select
							id="dest-select"
							bind:value={targetLadderId}
							class="w-full rounded-lg border-slate-200 text-sm"
						>
							<option value="">Create New Ladder</option>
							{#each $ladderStore.ladders.filter((l) => l.type === "tips-manual") as l (l.id)}
								<option value={l.id}>Update {l.name}</option>
							{/each}
						</select>
					</div>

					{#if !targetLadderId}
						<div class="space-y-2">
							<label
								for="new-name"
								class="block text-[10px] font-black uppercase tracking-wider text-slate-500"
								>New Ladder Name</label
							>
							<input
								id="new-name"
								type="text"
								bind:value={newLadderName}
								class="w-full rounded-lg border-slate-200 text-sm"
							/>
						</div>
					{/if}

					<div class="space-y-2">
						<label
							for="target-income"
							class="block text-[10px] font-black uppercase tracking-wider text-slate-500"
							>Target Annual Income ($)</label
						>
						<input
							id="target-income"
							type="number"
							bind:value={income}
							placeholder="Infer from holdings"
							class="w-full rounded-lg border-slate-200 text-sm"
						/>
					</div>
					{#if marketData}
						<div class="text-[10px] text-slate-500 leading-relaxed">
							Duration matching is unchanged. Cash deltas show clean-price
							primary totals.
							<br />
							Data source:
							<strong
								>{marketData.source === "fedinvest"
									? "FedInvest"
									: "Local CSV fallback"}</strong
							>
							· As of {marketData.asOfDate}
						</div>
					{/if}
				</div>

				<button
					onclick={rebalance}
					class="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-md transition-all"
				>
					Sync & Rebalance
				</button>
			</aside>

			<section class="lg:col-span-8 space-y-8">
				{#if !results}
					<div
						class="bg-white rounded-3xl border border-slate-200 p-12 text-center"
					>
						<div class="text-4xl mb-4">⚖️</div>
						<h3 class="font-serif text-xl font-bold">Ready to Sync</h3>
						<p class="text-slate-500 text-sm max-w-xs mx-auto mt-2">
							Run rebalance to see how your CSV matches your income goals.
						</p>
					</div>
				{:else}
					{#if results.summary.hasUnmetIncome}
						<div
							class="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-amber-900"
						>
							<div
								class="text-[10px] font-black uppercase tracking-widest text-amber-700 mb-2"
							>
								Unmet Income Years
							</div>
							<div class="text-sm font-semibold">
								Years: {results.summary.unmetYears?.join(", ")}
							</div>
							<div class="text-sm mt-1">
								Total shortfall:
								<strong
									>${Math.round(
										results.summary.unmetIncomeTotal || 0,
									).toLocaleString()}</strong
								>
							</div>
						</div>
					{/if}

					<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div
							class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
						>
							<div
								class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1"
							>
								Inferred DARA
							</div>
							<div class="font-serif text-2xl font-bold">
								${Math.round(results.summary.inferredDARA).toLocaleString()}
							</div>
						</div>
						<div
							class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
						>
							<div
								class="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1"
							>
								Target DARA
							</div>
							<div class="font-serif text-2xl font-bold">
								${Math.round(results.summary.DARA).toLocaleString()}
							</div>
						</div>
						<div
							class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
						>
							<div
								class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1"
							>
								Net Cash Delta (Clean)
							</div>
							<div
								class="font-serif text-2xl font-bold {results.summary
									.costDeltaSumClean >= 0
									? 'text-emerald-600'
									: 'text-red-600'}"
							>
								{results.summary.costDeltaSumClean >= 0 ? "+" : ""}${Math.round(
									results.summary.costDeltaSumClean,
								).toLocaleString()}
							</div>
							<div class="text-[10px] text-slate-500 mt-1">
								Adj:
								{results.summary.costDeltaSumAdjusted >= 0
									? "+"
									: ""}${Math.round(
									results.summary.costDeltaSumAdjusted,
								).toLocaleString()}
							</div>
						</div>
					</div>

					<div
						class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
					>
						<div class="p-6 border-b border-slate-100 bg-slate-50">
							<h3 class="font-serif text-xl font-bold">Maintenance Trades</h3>
						</div>
						<div class="overflow-x-auto">
							<table class="w-full text-left">
								<thead
									class="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400"
								>
									<tr>
										<th class="px-6 py-4">Security</th>
										<th class="px-6 py-4">Action</th>
										<th class="px-6 py-4 text-right">Cash Effect</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-slate-100">
									{#each results.results as row, index (legacyRowKey(row, index))}
										{#if legacyRowActionQty(row) !== 0}
											<tr class="hover:bg-slate-50 transition-colors">
												<td class="px-6 py-4">
													<div class="font-bold text-slate-900">
														{legacyRowCusip(row)}
													</div>
													<div class="text-[10px] text-slate-500">
														Matures {legacyRowMaturity(row)}
													</div>
												</td>
												<td class="px-6 py-4">
													<span
														class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold {legacyRowActionQty(
															row,
														) > 0
															? 'bg-emerald-100 text-emerald-800'
															: 'bg-red-100 text-red-800'}"
													>
														{legacyRowActionQty(row) > 0 ? "BUY" : "SELL"}
														{Math.abs(legacyRowActionQty(row)).toLocaleString()}
													</span>
												</td>
												<td
													class="px-6 py-4 text-right font-serif font-bold text-lg {legacyRowCleanCashEffect(
														row,
													) >= 0
														? 'text-emerald-600'
														: 'text-red-600'}"
												>
													<div>
														{legacyRowCleanCashEffect(row) >= 0
															? "+"
															: "-"}${Math.round(
															Math.abs(legacyRowCleanCashEffect(row)),
														).toLocaleString()}
													</div>
													<div class="text-[10px] font-sans text-slate-500">
														Adj:
														{legacyRowAdjustedCashEffect(row) >= 0
															? "+"
															: "-"}${Math.round(
															Math.abs(legacyRowAdjustedCashEffect(row)),
														).toLocaleString()}
													</div>
												</td>
											</tr>
										{/if}
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				{/if}
			</section>
		</div>
	{/if}
</div>
