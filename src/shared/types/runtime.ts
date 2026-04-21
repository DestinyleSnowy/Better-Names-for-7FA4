import type { ExtensionApiAdapter, StorageAdapter, DomAdapter } from '@shared/contracts/adapters';
import type { PageRoute } from '@shared/types/feature';
import type { StorageDefaults, StorageMigration, StorageSnapshot } from '@shared/types/storage';

export interface AdapterBundle {
    route: PageRoute;
    dom: DomAdapter;
    api: ExtensionApiAdapter;
    storage: StorageAdapter;
}

export interface PopupAppDependencies {
    api: ExtensionApiAdapter;
}

export interface StorageService {
    ensureMigrated(): Promise<StorageSnapshot>;
    read(): Promise<StorageSnapshot>;
    patch(partial: Partial<StorageSnapshot>): Promise<StorageSnapshot>;
}

export interface MessageBusContext {
    storageService: StorageService;
    platformState: {
        userAgent: string;
        runtime: string;
    };
}

export interface MessageBus {
    handle(message: { type: string }, context: MessageBusContext): Promise<unknown>;
}

export interface WorkerAppDependencies {
    api: ExtensionApiAdapter;
    storageService: StorageService;
    messageBus: MessageBus;
    platformState: {
        userAgent: string;
        runtime: string;
    };
}

export interface StorageServiceOptions {
    storage: StorageAdapter;
    defaults: StorageDefaults;
    migrations: StorageMigration[];
}
