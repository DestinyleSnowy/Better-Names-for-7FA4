import type { DomAdapter, ExtensionApiAdapter, StorageAdapter } from '@shared/contracts/adapters';

export type AppRuntime = 'content' | 'popup' | 'worker';
export type PageRoute = 'problem-list' | 'profile' | 'tag-detail' | 'unknown';
export type FeatureId = 'panel' | 'userMapping' | 'ranking' | 'profile' | 'tags';

export interface FeatureContext {
    runtime: AppRuntime;
    route: PageRoute;
    dom: DomAdapter;
    api: ExtensionApiAdapter;
    storage: StorageAdapter;
}

export interface FeatureDefinition {
    id: FeatureId;
    name: string;
    routes?: PageRoute[];
    setup(context: FeatureContext): Promise<void> | void;
}
