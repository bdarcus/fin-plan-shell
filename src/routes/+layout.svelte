<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { base } from "$app/paths";
	import { page } from "$app/state";
	import { registry } from "$lib";
	import { onMount, type Snippet } from "svelte";
	import "./layout.css";
	import { goto } from "$app/navigation";

	let { children }: { children: Snippet } = $props();

	onMount(() => {
		registry.loadRegistry();
	});

	let isMenuOpen = $state(false);

	function setActive(id: string | null) {
		registry.setActive(id);
		isMenuOpen = false;
		if (id) {
			// When selecting a module from the top nav, always go to the Design (Configure) page
			// for that module to ensure the view actually updates and avoids confusion.
			goto(`${base}/design`);
		} else {
			goto(`${base}/`);
		}
	}

	function handleImportSync() {
		goto(`${base}/import`);
	}
</script>

<div
	class="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-emerald-100 selection:text-emerald-900"
>
	<!-- Top Navigation Bar -->
	<nav
		class="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200"
	>
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="flex justify-between h-16">
				<div class="flex items-center">
					<div class="flex-shrink-0 flex items-center">
						<a
							href="{base}/"
							onclick={(e) => {
								e.preventDefault();
								setActive(null);
							}}
							class="flex items-center space-x-2 group"
						>
							<div
								class="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white font-serif font-bold text-xl group-hover:scale-110 transition-transform"
							>
								F
							</div>
							<span
								class="text-lg font-serif font-bold tracking-tight text-slate-900"
								>Financial Modulator</span
							>
						</a>
					</div>

					<!-- Desktop Module Navigation -->
					<div class="hidden sm:ml-10 sm:flex sm:space-x-8 h-16">
						{#each registry.enabledModulesList as m (m.id)}
							<button
								onclick={() => setActive(m.id)}
								class="inline-flex items-center px-3 pt-1 border-b-2 text-sm font-medium transition-colors {m.id ===
								registry.activeId
									? 'border-emerald-500 text-emerald-600'
									: 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}"
							>
								{m.name}
							</button>
						{/each}
					</div>
				</div>

				<div class="hidden sm:flex items-center space-x-4">
					<a
						href="{base}/resources"
						class="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors"
						>Guidance</a
					>
					<div class="h-4 w-px bg-slate-200"></div>
					<button
						onclick={handleImportSync}
						class="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors"
						>Import/Sync</button
					>
				</div>

				<!-- Mobile menu button -->
				<div class="flex items-center sm:hidden">
					<button
						onclick={() => (isMenuOpen = !isMenuOpen)}
						class="inline-flex items-center justify-center p-2 rounded-md text-slate-400 hover:text-slate-500 hover:bg-slate-100 transition-colors"
					>
						<span class="sr-only">Open main menu</span>
						<svg
							class="h-6 w-6"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d={isMenuOpen
									? "M6 18L18 6M6 6l12 12"
									: "M4 6h16M4 12h16M4 18h16"}
							/>
						</svg>
					</button>
				</div>
			</div>
		</div>

		<!-- Mobile menu -->
		{#if isMenuOpen}
			<div
				class="sm:hidden bg-white border-b border-slate-200 animate-in slide-in-from-top-4"
			>
				<div class="pt-2 pb-3 space-y-1">
					<a
						href="{base}/"
						onclick={(e) => {
							e.preventDefault();
							setActive(null);
						}}
						class="block pl-3 pr-4 py-2 border-l-4 text-base font-medium {registry.activeId ===
						null
							? 'bg-emerald-50 border-emerald-500 text-emerald-700'
							: 'border-transparent text-slate-600 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800'}"
						>Dashboard</a
					>
					{#each registry.enabledModulesList as m (m.id)}
						<button
							onclick={() => setActive(m.id)}
							class="w-full text-left block pl-3 pr-4 py-2 border-l-4 text-base font-medium {m.id ===
							registry.activeId
								? 'bg-emerald-50 border-emerald-500 text-emerald-700'
								: 'border-transparent text-slate-600 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800'}"
						>
							{m.name}
						</button>
					{/each}
				</div>
				<div class="pt-4 pb-3 border-t border-slate-200">
					<div class="space-y-1">
						<a
							href="{base}/resources"
							onclick={() => {
								setActive(null);
							}}
							class="block px-4 py-2 text-base font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-50"
							>Guidance</a
						>
						<button
							onclick={() => {
								handleImportSync();
								isMenuOpen = false;
							}}
							class="w-full text-left block px-4 py-2 text-base font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-50"
							>Import/Sync</button
						>
					</div>
				</div>
			</div>
		{/if}
	</nav>

	<!-- Main Content Area -->
	<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		{#if registry.activeId}
			{#key registry.activeId}
				{@const activeModule = registry.getModule(registry.activeId)}
				{#if activeModule}
					<div
						class="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500"
					>
						<header
							class="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8"
						>
							<div class="flex items-center space-x-4">
								<div
									class="p-3 bg-white rounded-2xl shadow-sm border border-slate-200 text-slate-600"
								>
									<activeModule.ui.Icon />
								</div>
								<div>
									<h1 class="text-3xl font-serif font-bold text-slate-900">
										{activeModule.name}
									</h1>
									<p class="text-slate-500 text-sm">{activeModule.description}</p>
								</div>
							</div>

							<!-- Sub-navigation for active module -->
							<nav class="flex bg-slate-200/50 p-1 rounded-xl">
								<a
									href="{base}/design"
									class="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all {page.url.pathname.endsWith(
										'design',
									)
										? 'bg-white text-slate-900 shadow-sm'
										: 'text-slate-500 hover:text-slate-700'}"
								>
									Configure
								</a>
								<a
									href="{base}/track"
									class="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all {page.url.pathname.endsWith(
										'track',
									)
										? 'bg-white text-slate-900 shadow-sm'
										: 'text-slate-500 hover:text-slate-700'}"
								>
									Analysis
								</a>
								{#if activeModule.ui.Import}
									<a
										href="{base}/import"
										class="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all {page.url.pathname.endsWith(
											'import',
										)
											? 'bg-white text-slate-900 shadow-sm'
											: 'text-slate-500 hover:text-slate-700'}"
									>
										Sync
									</a>
								{/if}
							</nav>
						</header>

						{@render children()}
					</div>
				{/if}
			{/key}
		{:else}
			<div class="animate-in fade-in duration-700">
				{@render children()}
			</div>
		{/if}
	</main>

	<footer
		class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-slate-200"
	>
		<div class="flex flex-col md:flex-row justify-between items-center gap-6">
			<div class="flex items-center space-x-2 grayscale opacity-50">
				<div
					class="w-6 h-6 bg-slate-900 rounded flex items-center justify-center text-white font-serif font-bold text-sm"
				>
					F
				</div>
				<span class="text-sm font-serif font-bold tracking-tight text-slate-900"
					>Financial Modulator</span
				>
			</div>
			<p
				class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400"
			>
				Modular Retirement Planning Engine &copy; 2026
			</p>
			<div class="flex space-x-6">
				<a
					href="https://github.com/bdarcus/fin-plan-shell"
					target="_blank"
					rel="noopener noreferrer"
					aria-label="GitHub Repository"
					class="text-slate-400 hover:text-slate-600 transition-colors"
				>
					<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"
						><path
							fill-rule="evenodd"
							d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
							clip-rule="evenodd"
						/></svg
					>
				</a>
			</div>
		</div>
	</footer>
</div>
