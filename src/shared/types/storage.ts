export interface StorageSnapshot {
    schemaVersion: number;
    platform: {
        installedAt: string | null;
        installReason: string | null;
    };
    featureFlags: {
        panel: boolean;
        userMapping: boolean;
        ranking: boolean;
    };
}

export type StorageDefaults = StorageSnapshot;

export interface StorageMigration {
    toVersion: number;
    up(snapshot: StorageSnapshot): StorageSnapshot;
}
