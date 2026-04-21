import { STORAGE_DEFAULTS } from '@config/defaults/storage-defaults';
import type { FeatureFlags, StorageSnapshot } from '@shared/types/storage';

export function resolveFeatureFlags(snapshot?: StorageSnapshot | null): FeatureFlags {
    return {
        ...STORAGE_DEFAULTS.featureFlags,
        ...snapshot?.featureFlags
    };
}
