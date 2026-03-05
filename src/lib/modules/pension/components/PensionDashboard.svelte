<script lang="ts">
	// biome-ignore lint/correctness/noUnusedImports: used in template
	import { formatCurrency } from "../../../shared/financial";
	// biome-ignore lint/correctness/noUnusedImports: used in template
	import { pensionStore } from "../store/pension";

	// biome-ignore lint/correctness/noUnusedVariables: used in template
	let state = $derived($pensionStore);
</script>

<div class="space-y-3">
	<div class="flex justify-between items-end">
		<div>
			<div
				class="text-[10px] font-black uppercase tracking-widest text-slate-400"
			>
				Start Year
			</div>
			<div class="text-2xl font-serif font-bold text-slate-900">
				{state.startYear}
			</div>
		</div>
		<div class="text-right">
			<div
				class="text-[10px] font-black uppercase tracking-widest text-slate-400"
			>
				Monthly
			</div>
			<div class="text-sm font-bold text-indigo-600">
				{formatCurrency(state.amount)}
			</div>
		</div>
	</div>
</div>
