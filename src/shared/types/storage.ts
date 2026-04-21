export interface FeatureFlags {
    panel: boolean;
    userMapping: boolean;
    ranking: boolean;
    profile: boolean;
    tags: boolean;
}

export interface StorageSnapshot {
    schemaVersion: number;
    platform: {
        installedAt: string | null;
        installReason: string | null;
    };
    featureFlags: FeatureFlags;
}

export type StorageDefaults = StorageSnapshot;

export interface StorageMigration {
    toVersion: number;
    up(snapshot: StorageSnapshot): StorageSnapshot;
}
