import { SvelteMap } from "svelte/reactivity";
import type { BaseFinancialModule } from "./types";

class ModuleRegistry {
	modules = new SvelteMap<string, BaseFinancialModule>();
	activeId = $state<string | null>(null);
	enabledMap = $state<Record<string, boolean>>({});

	register(module: BaseFinancialModule) {
		this.modules.set(module.id, module);
		if (this.enabledMap[module.id] === undefined) {
			this.enabledMap = { ...this.enabledMap, [module.id]: true };
		}
	}

	loadRegistry() {
		if (typeof localStorage !== "undefined") {
			const saved = localStorage.getItem("registry_enabled_modules");
			if (saved) {
				try {
					this.enabledMap = { ...this.enabledMap, ...JSON.parse(saved) };
				} catch (e) {
					console.error("Failed to parse registry state", e);
				}
			}
		}
	}

	saveRegistry() {
		if (typeof localStorage !== "undefined") {
			localStorage.setItem(
				"registry_enabled_modules",
				JSON.stringify(this.enabledMap),
			);
		}
	}

	loadFromData(data: Record<string, boolean>) {
		this.enabledMap = { ...this.enabledMap, ...data };
		this.saveRegistry();
	}

	toggleModule(id: string) {
		this.enabledMap[id] = !this.enabledMap[id];
		this.saveRegistry();
	}

	isEnabled(id: string) {
		return this.enabledMap[id] ?? false;
	}

	getModule<T extends BaseFinancialModule = BaseFinancialModule>(
		id: string,
	): T | undefined {
		return this.modules.get(id) as T | undefined;
	}

	get allModulesList() {
		// Accessing modules.size ensures reactivity triggers when items are added/removed
		if (this.modules.size >= 0) {
			return Array.from(this.modules.values());
		}
		return [];
	}

	get enabledModulesList() {
		return this.allModulesList.filter((m) => this.enabledMap[m.id]);
	}

	setActive(id: string | null) {
		this.activeId = id;
	}
}

export const registry = new ModuleRegistry();
