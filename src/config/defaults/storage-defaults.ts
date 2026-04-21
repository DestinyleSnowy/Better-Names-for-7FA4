import type { StorageDefaults } from '@shared/types/storage';

export const STORAGE_DEFAULTS: StorageDefaults = {
    schemaVersion: 1,
    platform: {
        installedAt: null,
        installReason: null
    },
    featureFlags: {
        panel: true,
        userMapping: true,
        ranking: false
    }
};
