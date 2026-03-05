<script lang="ts">
import { get } from "svelte/store";
import { pensionStore } from "../store/pension";

let _sv = $derived($pensionStore);
let saved = $state(false);
function _handleSave() {
	pensionStore.save(get(pensionStore));
	saved = true;
	setTimeout(() => (saved = false), 2000);
}
</script>
<div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
	<h2 class="font-serif text-2xl font-bold">Pension</h2>
	<input type="number" value={sv.amount} oninput={(e) => pensionStore.update(s => ({...s, amount: parseFloat((e.target as HTMLInputElement).value)}))} class="w-full rounded-lg border-slate-200" />
	<button onclick={handleSave} class="w-full py-3 bg-indigo-600 text-white rounded-xl">{saved ? "Saved" : "Save"}</button>
</div>