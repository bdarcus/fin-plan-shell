import { get } from 'svelte/store';
import { registry } from '../core/registry.svelte';
import { planningStore } from './planning';

/**
 * Aggregates all application data into a single serializable object.
 * Now dynamically collects data from all registered modules.
 */
export function exportAllData() {
    const data: any = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        planning: get(planningStore)
    };

    // Collect data from all registered modules
    for (const module of registry.allModulesList) {
        data[module.id] = get(module.store as any);
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `financial-plan-${new Date().toLocaleDateString('en-CA')}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

/**
 * Parses and hydrates all stores from a single data object.
 * Now dynamically hydrates all registered modules.
 */
export function importAllData(json: string) {
    try {
        const data = JSON.parse(json);

        if (data.planning) planningStore.save(data.planning);

        // Hydrate each registered module if data exists for it
        for (const module of registry.allModulesList) {
            if (data[module.id]) {
                module.store.save(data[module.id]);
            }
        }

        return true;
    } catch (e) {
        console.error('Import failed:', e);
        return false;
    }
}
