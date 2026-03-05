<script lang="ts">
	import { get } from "svelte/store";
	import { planningStore } from "../../../shared/planning";

	let sv = $derived($planningStore);
	let saved = $state(false);
	function handleSave() {
		planningStore.save(get(planningStore));
		saved = true;
		setTimeout(() => (saved = false), 2000);
	}
</script>

<div
	class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4"
>
	<h2 class="font-serif text-2xl font-bold">Planning</h2>
	<div class="space-y-4">
		{#each sv.people as person, i (i)}
			<div class="space-y-1">
				<label
					for="person-age-{i}"
					class="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1"
					>Person {i + 1} Age</label
				>
				<input
					id="person-age-{i}"
					type="number"
					bind:value={person.age}
					class="w-full rounded-lg border-slate-200"
				/>
			</div>
		{/each}
		<div class="space-y-1">
			<label
				for="conservatism-margin"
				class="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1"
				>Conservatism Margin ({Math.round(sv.conservatismMargin * 100)}%)</label
			>
			<input
				id="conservatism-margin"
				type="range"
				min="0"
				max="1"
				step="0.01"
				bind:value={sv.conservatismMargin}
				class="w-full"
			/>
		</div>
	</div>
	<button
		onclick={handleSave}
		class="w-full py-3 bg-slate-900 text-white rounded-xl"
		>{saved ? "Saved" : "Save"}</button
	>
</div>
