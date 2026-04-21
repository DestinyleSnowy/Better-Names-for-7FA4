import {
    PANEL_DEFAULT_SETTINGS,
    PANEL_SETTINGS_STORAGE_KEY,
    type PanelSettings
} from '@features/panel/panel-catalog';
import type { StorageAdapter } from '@shared/contracts/adapters';

export function mergePanelSettings(value: unknown): PanelSettings {
    if (!value || typeof value !== 'object') {
        return { ...PANEL_DEFAULT_SETTINGS };
    }

    return {
        ...PANEL_DEFAULT_SETTINGS,
        ...(value as Partial<PanelSettings>)
    };
}

export async function loadPanelSettings(storage: StorageAdapter): Promise<PanelSettings> {
    const snapshot = await storage.get<PanelSettings>(PANEL_SETTINGS_STORAGE_KEY);
    return mergePanelSettings(snapshot);
}

export function watchPanelSettings(onChange: (settings: PanelSettings) => void): () => void {
    if (!chrome?.storage?.onChanged) {
        return () => {};
    }

    const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (changes, areaName) => {
        if (areaName !== 'local') {
            return;
        }

        if (!Object.prototype.hasOwnProperty.call(changes, PANEL_SETTINGS_STORAGE_KEY)) {
            return;
        }

        const change = changes[PANEL_SETTINGS_STORAGE_KEY];
        onChange(mergePanelSettings(change?.newValue));
    };

    chrome.storage.onChanged.addListener(listener);
    return () => {
        chrome.storage.onChanged.removeListener(listener);
    };
}
