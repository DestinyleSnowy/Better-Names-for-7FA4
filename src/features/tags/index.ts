import type { FeatureDefinition } from '@shared/types/feature';

export function createTagFeature(): FeatureDefinition {
    return {
        name: 'tags',
        routes: ['tag-detail'],
        async setup(_context) {
            // Placeholder for tag details features.
        }
    };
}
