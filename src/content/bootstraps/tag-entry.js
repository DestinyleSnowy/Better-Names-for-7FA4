import { createDomContext } from '../core/dom/dom-context.js';
import { createFeatureRegistry } from '../core/runtime/feature-registry.js';
import { registerTagViewFeature } from '../features/tag-view/index.js';

export function bootstrapTagContent() {
    const context = createDomContext(document);
    const registry = createFeatureRegistry(context);

    registerTagViewFeature(registry);

    return registry;
}
