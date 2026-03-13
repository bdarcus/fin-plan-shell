<script lang="ts">
	import { get } from "svelte/store";
	import { planningStore } from "../../../shared/planning";

	let sv = $derived($planningStore);
	let saved = $state(false);
	let dirty = $state(false);
	function handleSave() {
		planningStore.save(get(planningStore));
		dirty = false;
		saved = true;
		setTimeout(() => (saved = false), 2000);
	}

	function updatePersonAge(index: number, age: string) {
		const parsed = Number.parseFloat(age);
		if (Number.isNaN(parsed)) return;

		dirty = true;
		saved = false;
		planningStore.update((s) => {
			const newPeople = [...s.people];
			newPeople[index] = { ...newPeople[index], age: parsed };
			return { ...s, people: newPeople };
		});
	}

	function updateConservatism(val: string) {
		const parsed = Number.parseFloat(val);
		if (Number.isNaN(parsed)) return;

		dirty = true;
		saved = false;
		planningStore.update((s) => ({
			...s,
			conservatismMargin: parsed,
		}));
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
					value={person.age}
					oninput={(e) =>
						updatePersonAge(i, (e.target as HTMLInputElement).value)}
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
				value={sv.conservatismMargin}
				oninput={(e) =>
					updateConservatism((e.target as HTMLInputElement).value)}
				class="w-full"
			/>
		</div>
	</div>
	<button
		onclick={handleSave}
		title={dirty ? "Save planning settings" : "Save planning settings"}
		class="w-full py-3 bg-slate-900 text-white rounded-xl"
		>{saved ? "Saved" : "Save"}</button
	>
</div>
