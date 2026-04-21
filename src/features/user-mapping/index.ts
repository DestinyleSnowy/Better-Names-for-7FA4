import { mountIdentityEnhancements } from '@features/user-mapping/identity-enhancements';
import type { FeatureDefinition } from '@shared/types/feature';

export function createUserMappingFeature(): FeatureDefinition {
    return {
        id: 'userMapping',
        name: 'user-mapping',
        routes: ['problem-list', 'profile', 'tag-detail'],
        async setup(context) {
            if (context.dom.root.body.dataset.bnIdentityMounted === '1') {
                return;
            }

            context.dom.root.body.dataset.bnIdentityMounted = '1';
            await mountIdentityEnhancements(context.dom.root, context.storage);
        }
    };
}
