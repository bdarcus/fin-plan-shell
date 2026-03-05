<script lang="ts">
import { get } from "svelte/store";
import { registry } from "../../../core/registry.svelte";
import { portfolioStore } from "../store/portfolio";

let _sv = $derived($portfolioStore);
let _calculated = $derived.by(() =>
	registry.getModule("portfolio-manager")?.engine.calculate({}),
);
let saved = $state(false);
function _handleSave() {
	portfolioStore.save(get(portfolioStore));
	saved = true;
	setTimeout(() => (saved = false), 2000);
}
</script>
<div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
	<h2 class="font-serif text-2xl font-bold">Portfolio</h2>
	<input type="number" value={sv.balance} oninput={(e) => portfolioStore.update(s => ({...s, balance: parseFloat((e.target as HTMLInputElement).value)}))} class="w-full rounded-lg border-slate-200" />
	<button onclick={handleSave} class="w-full py-3 bg-blue-600 text-white rounded-xl">{saved ? "Saved" : "Save"}</button>
</div>