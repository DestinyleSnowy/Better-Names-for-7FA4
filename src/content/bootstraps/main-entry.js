import { createDomContext } from '../core/dom/dom-context.js';
import { createFeatureRegistry } from '../core/runtime/feature-registry.js';
import { registerPanelFeature } from '../features/panel/index.js';
import { registerPlanAdderFeature } from '../features/plan-adder/index.js';
import { registerUserMappingFeature } from '../features/user-mapping/index.js';

export function bootstrapMainContent() {
    const context = createDomContext(document);
    const registry = createFeatureRegistry(context);

    registerUserMappingFeature(registry);
    registerPlanAdderFeature(registry);
    registerPanelFeature(registry);

    return registry;
}
