import { createFeatureRegistry } from '@app/content/composition/create-feature-registry';
import { getFeatureDefinitions } from '@features/index';
import type { FeatureContext } from '@shared/types/feature';
import type { AdapterBundle } from '@shared/types/runtime';

export function createContentApp(bundle: AdapterBundle) {
    const registry = createFeatureRegistry(getFeatureDefinitions());

    return {
        async mount() {
            await bundle.dom.ready();

            const context: FeatureContext = {
                runtime: 'content',
                route: bundle.route,
                dom: bundle.dom,
                api: bundle.api,
                storage: bundle.storage
            };

            for (const feature of registry.getByRoute(bundle.route)) {
                await feature.setup(context);
            }
        }
    };
}
