import type { StorageSnapshot } from '@shared/types/storage';

export const STORAGE_SCHEMA_VERSION = 1;

export function isStorageSnapshot(value: unknown): value is StorageSnapshot {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as StorageSnapshot;
    return typeof candidate.schemaVersion === 'number';
}
