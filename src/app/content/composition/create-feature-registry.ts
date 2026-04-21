import type { FeatureDefinition, PageRoute } from '@shared/types/feature';

export function createFeatureRegistry(features: FeatureDefinition[]) {
    return {
        getByRoute(route: PageRoute) {
            return features.filter((feature) => {
                if (!feature.routes || feature.routes.length === 0) {
                    return true;
                }
                return feature.routes.includes(route);
            });
        }
    };
}
