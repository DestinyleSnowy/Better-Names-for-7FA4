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
    }
];
