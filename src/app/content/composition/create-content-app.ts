import { createFeatureRegistry } from '@app/content/composition/create-feature-registry';
import { resolveFeatureFlags } from '@config/feature-flags/resolve-feature-flags';
import { getFeatureDefinitions } from '@features/index';
import type { FeatureContext } from '@shared/types/feature';
import type { AdapterBundle } from '@shared/types/runtime';
import type { StorageSnapshot } from '@shared/types/storage';

export function createContentApp(bundle: AdapterBundle) {
    const registry = createFeatureRegistry(getFeatureDefinitions());

    return {
        async mount() {
            await bundle.dom.ready();
            const snapshot = await bundle.storage.get<StorageSnapshot>('appStorage');
            const featureFlags = resolveFeatureFlags(snapshot);

            const context: FeatureContext = {
                runtime: 'content',
                route: bundle.route,
                dom: bundle.dom,
                api: bundle.api,
                storage: bundle.storage
            };

            for (const feature of registry.getByRoute(bundle.route, featureFlags)) {
                await feature.setup(context);
            }
        }
    };
}
