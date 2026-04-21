import type { FeatureDefinition } from '@shared/types/feature';

export function createPanelFeature(): FeatureDefinition {
    return {
        id: 'panel',
        name: 'panel',
        routes: ['problem-list', 'profile', 'tag-detail'],
        async setup(context) {
            const host = context.dom.ensureRoot('bn-refactor-panel-host');
            host.textContent = 'panel feature mounted';
        }
    };
}
