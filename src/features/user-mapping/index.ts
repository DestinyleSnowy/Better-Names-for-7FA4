import type { FeatureDefinition } from '@shared/types/feature';

export function createUserMappingFeature(): FeatureDefinition {
    return {
        name: 'user-mapping',
        routes: ['problem-list', 'profile'],
        async setup(context) {
            await context.storage.get('userMapping');
        }
    };
}
