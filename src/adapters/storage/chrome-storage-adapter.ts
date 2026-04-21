import type { StorageAdapter } from '@shared/contracts/adapters';

export function createChromeStorageAdapter(): StorageAdapter {
    return {
        async get<T>(key: string): Promise<T | undefined> {
            const items = await chrome.storage.local.get([key]);
            return items[key] as T | undefined;
        },
        async set(key: string, value: unknown): Promise<void> {
            await chrome.storage.local.set({ [key]: value });
        }
    };
}
