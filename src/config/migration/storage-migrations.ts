import { STORAGE_DEFAULTS } from '@config/defaults/storage-defaults';
import type { StorageMigration } from '@shared/types/storage';

export const STORAGE_MIGRATIONS: StorageMigration[] = [
    {
        toVersion: 1,
        up(snapshot) {
            return {
                ...snapshot,
                schemaVersion: 1
            };
        }
    },
    {
        toVersion: 2,
        up(snapshot) {
            return {
                ...snapshot,
                schemaVersion: 2,
                featureFlags: {
                    ...STORAGE_DEFAULTS.featureFlags,
                    ...snapshot.featureFlags
                }
            };
        }
    }
];
