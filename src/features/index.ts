import { createPanelFeature } from '@features/panel';
import { createProfileFeature } from '@features/profile';
import { createRankingFeature } from '@features/ranking';
import { createTagFeature } from '@features/tags';
import { createUserMappingFeature } from '@features/user-mapping';
import type { FeatureDefinition } from '@shared/types/feature';

export function getFeatureDefinitions(): FeatureDefinition[] {
    return [
        createPanelFeature(),
        createUserMappingFeature(),
        createRankingFeature(),
        createProfileFeature(),
        createTagFeature()
    ];
}
