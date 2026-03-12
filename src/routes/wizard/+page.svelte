<script lang="ts">
	import { registry } from "$lib";
</script>

{#if registry.activeId}
	{@const activeModule = registry.getModule(registry.activeId)}
	{#if activeModule}
		{#if activeModule.ui.Wizard}
			{@const Wizard = activeModule.ui.Wizard}
			<Wizard />
		{:else}
			<div class="p-12 text-center text-slate-400">
				The selected module "{activeModule.name}" does not support wizard
				actions.
			</div>
		{/if}
	{/if}
{:else}
	<div class="p-12 text-center text-slate-400">
		Please select a module to view wizard.
	</div>
{/if}
