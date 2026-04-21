import type { StorageSnapshot } from '@shared/types/storage';

export const STORAGE_SCHEMA_VERSION = 2;

export function isStorageSnapshot(value: unknown): value is StorageSnapshot {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as StorageSnapshot;
    return (
        typeof candidate.schemaVersion === 'number' &&
        !!candidate.platform &&
        typeof candidate.platform === 'object' &&
        !!candidate.featureFlags &&
        typeof candidate.featureFlags === 'object'
    );
}
