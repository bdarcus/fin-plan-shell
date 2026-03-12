<script lang="ts">
	// eslint-disable-line no-unused-vars
	import { get } from "svelte/store";
	// eslint-disable-line no-unused-vars
	import { registry } from "../../../core/registry.svelte";
	// eslint-disable-line no-unused-vars
	import { portfolioStore } from "../store/portfolio";

	// eslint-disable-line no-unused-vars
	let sv = $derived($portfolioStore);
	// eslint-disable-line no-unused-vars
	let _calculated = $derived.by(() =>
		registry.getModule("portfolio-manager")?.engine.calculate({}),
	);
	let saved = $state(false);
	// eslint-disable-line no-unused-vars
	function handleSave() {
		portfolioStore.save(get(portfolioStore));
		saved = true;
		setTimeout(() => (saved = false), 2000);
	}
</script>

<div
	class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4"
>
	<h2 class="font-serif text-2xl font-bold">Portfolio</h2>
	<div class="space-y-1">
		<label
			for="portfolio-balance"
			class="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1"
			>Total Account Balance</label
		>
		<input
			id="portfolio-balance"
			type="number"
			value={sv.balance}
			oninput={(e) =>
				portfolioStore.update((s) => ({
					...s,
					balance: parseFloat((e.target as HTMLInputElement).value),
				}))}
			class="w-full rounded-lg border-slate-200"
		/>
	</div>
	<button
		onclick={handleSave}
		class="w-full py-3 bg-blue-600 text-white rounded-xl"
		>{saved ? "Saved" : "Save"}</button
	>
</div>
