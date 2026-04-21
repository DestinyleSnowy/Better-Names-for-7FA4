import type { FeatureDefinition, PageRoute } from '@shared/types/feature';
import type { FeatureFlags } from '@shared/types/storage';

export function createFeatureRegistry(features: FeatureDefinition[]) {
    return {
        getByRoute(route: PageRoute, featureFlags: FeatureFlags) {
            return features.filter((feature) => {
                if (!featureFlags[feature.id]) {
                    return false;
                }
                if (!feature.routes || feature.routes.length === 0) {
                    return true;
                }
                return feature.routes.includes(route);
            });
        }
    };
}
