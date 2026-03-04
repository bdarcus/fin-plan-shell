<script lang="ts">
import { get } from "svelte/store";
import { ssStore } from "../store/ss";

let sv = $derived($ssStore);
let saved = $state(false);
function handleSave() {
	ssStore.save(get(ssStore));
	saved = true;
	setTimeout(() => (saved = false), 2000);
}
</script>
<div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
	<h2 class="font-serif text-2xl font-bold">Social Security</h2>
	<input type="number" value={sv.annualBenefit} oninput={(e) => ssStore.update(s => ({...s, annualBenefit: parseFloat((e.target as HTMLInputElement).value)}))} class="w-full rounded-lg border-slate-200" />
	<button onclick={handleSave} class="w-full py-3 bg-emerald-600 text-white rounded-xl">{saved ? "Saved" : "Save"}</button>
</div>