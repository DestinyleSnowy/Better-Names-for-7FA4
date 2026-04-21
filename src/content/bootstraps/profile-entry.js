import { createDomContext } from '../core/dom/dom-context.js';
import { createFeatureRegistry } from '../core/runtime/feature-registry.js';
import { registerProfileInterceptorFeature } from '../features/profile-interceptor/index.js';

export function bootstrapProfileContent() {
    const context = createDomContext(document);
    const registry = createFeatureRegistry(context);

    registerProfileInterceptorFeature(registry);

    return registry;
}
