import type { StorageDefaults, StorageMigration, StorageSnapshot } from '@shared/types/storage';
import type { StorageAdapter } from '@shared/contracts/adapters';

interface StorageServiceOptions {
    storage: StorageAdapter;
    defaults: StorageDefaults;
    migrations: StorageMigration[];
}

export function createStorageService({ storage, defaults, migrations }: StorageServiceOptions) {
    async function read(): Promise<StorageSnapshot> {
        const snapshot = await storage.get<StorageSnapshot>('appStorage');
        if (snapshot) {
            return snapshot;
        }

        return {
            ...defaults
        };
    }

    async function patch(partial: Partial<StorageSnapshot>) {
        const current = await read();
        const next: StorageSnapshot = {
            ...current,
            ...partial,
            platform: {
                ...current.platform,
                ...partial.platform
            }
        };
        await storage.set('appStorage', next);
        return next;
    }

    async function ensureMigrated() {
        const snapshot = await read();
        let next = snapshot;

        for (const migration of migrations) {
            if (next.schemaVersion < migration.toVersion) {
                next = migration.up(next);
            }
        }

        await storage.set('appStorage', next);
        return next;
    }

    return {
        ensureMigrated,
        read,
        patch
    };
}
