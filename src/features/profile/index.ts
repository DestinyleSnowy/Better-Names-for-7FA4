import type { FeatureDefinition } from '@shared/types/feature';

export function createProfileFeature(): FeatureDefinition {
    return {
        id: 'profile',
        name: 'profile',
        routes: ['profile'],
        async setup(_context) {
            // Placeholder for user profile features.
        }
    };
}
