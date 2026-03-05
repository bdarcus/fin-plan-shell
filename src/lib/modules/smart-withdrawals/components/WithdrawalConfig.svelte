<script lang="ts">
import { get } from "svelte/store";
import { planningStore } from "../../../shared/planning";

let _sv = $derived($planningStore);
let saved = $state(false);
function _handleSave() {
	planningStore.save(get(planningStore));
	saved = true;
	setTimeout(() => (saved = false), 2000);
}
</script>
<div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
	<h2 class="font-serif text-2xl font-bold">Planning</h2>
	<button onclick={handleSave} class="w-full py-3 bg-slate-900 text-white rounded-xl">{saved ? "Saved" : "Save"}</button>
</div>