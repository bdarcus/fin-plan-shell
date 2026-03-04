<script lang="ts">
import { formatCurrency } from "../../../shared/financial";
import { planningHorizon } from "../../../shared/planning";
import { expectedRealReturn, portfolioStore } from "../store/portfolio";

let state = $derived($portfolioStore);
let realReturn = $derived($expectedRealReturn);
let horizon = $derived($planningHorizon);
</script>

<div class="space-y-3">
	<div class="flex justify-between items-end">
		<div>
			<div class="text-[10px] font-black uppercase tracking-widest text-slate-400">Balance</div>
			<div class="text-2xl font-serif font-bold text-slate-900">{formatCurrency(state.balance)}</div>
		</div>
		<div class="text-right">
			<div class="text-[10px] font-black uppercase tracking-widest text-slate-400">Horizon</div>
			<div class="text-sm font-bold text-blue-600">{horizon.horizonYear}</div>
		</div>
	</div>
	
	<div class="pt-2 border-t border-slate-100">
		<div class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Asset Allocation</div>
		<div class="flex items-center space-x-2">
			<div class="h-2 flex-1 bg-slate-100 rounded-full overflow-hidden flex">
				<div class="h-full bg-blue-500" style="width: {state.equityAllocation * 100}%"></div>
				<div class="h-full bg-slate-300" style="width: {(1 - state.equityAllocation) * 100}%"></div>
			</div>
			<span class="text-[10px] font-bold text-slate-600">{Math.round(state.equityAllocation * 100)}% Equity</span>
		</div>
	</div>
</div>
