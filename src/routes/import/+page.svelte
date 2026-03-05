<script lang="ts">
	import { registry } from "$lib";
	import { exportAllData, importAllData } from "$lib/shared/persistence";

	async function handleImport(e: Event) {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;
		const text = await file.text();
		if (importAllData(text)) {
			window.location.reload();
		}
	}
</script>

{#if registry.activeId}
	{@const activeModule = registry.getModule(registry.activeId)}
	{#if activeModule && activeModule.ui.Import}
		{@const Import = activeModule.ui.Import}
		<Import />
	{:else}
		<div
			class="p-12 text-center text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200"
		>
			<div class="text-4xl mb-4">📁</div>
			<h3 class="text-xl font-bold text-slate-900">Import Not Supported</h3>
			<p class="mt-2">
				The selected module "{activeModule?.name}" does not support data import.
			</p>
		</div>
	{/if}
{:else}
	<div class="max-w-4xl mx-auto space-y-8">
		<section
			class="bg-white p-8 md:p-12 rounded-3xl border border-slate-200 shadow-sm"
		>
			<div class="max-w-2xl">
				<h2 class="text-2xl font-serif font-bold text-slate-900 mb-4">
					Data Management
				</h2>
				<p class="text-slate-500 mb-8">
					Export your entire plan configuration and data to a local JSON file,
					or restore from a previous backup. This includes all enabled modules
					and their settings.
				</p>

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<button
						onclick={exportAllData}
						class="flex items-center justify-center space-x-3 px-6 py-4 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 transition-colors font-bold shadow-lg"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline
								points="7 10 12 15 17 10"
							/><line x1="12" x2="12" y1="3" y2="15" /></svg
						>
						<span>Save Data</span>
					</button>

					<label
						class="flex items-center justify-center space-x-3 px-6 py-4 bg-white border-2 border-slate-200 text-slate-900 rounded-2xl hover:border-emerald-500 hover:text-emerald-600 transition-all font-bold cursor-pointer"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline
								points="17 8 12 3 7 8"
							/><line x1="12" x2="12" y1="3" y2="15" /></svg
						>
						<span>Load Data</span>
						<input
							type="file"
							accept=".json"
							onchange={handleImport}
							class="hidden"
						/>
					</label>
				</div>
			</div>
		</section>

		<div
			class="p-6 bg-amber-50 rounded-2xl border border-amber-100 flex items-start space-x-4"
		>
			<div class="p-2 bg-amber-100 text-amber-700 rounded-lg">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					><circle cx="12" cy="12" r="10" /><line
						x1="12"
						y1="8"
						x2="12"
						y2="12"
					/><line x1="12" y1="16" x2="12.01" y2="16" /></svg
				>
			</div>
			<div class="text-sm text-amber-800 leading-relaxed">
				<strong>Security Note:</strong> Your data is stored locally in your browser
				and never sent to any server. Exporting a backup allows you to keep your data
				safe even if you clear your browser cache.
			</div>
		</div>
	</div>
{/if}
