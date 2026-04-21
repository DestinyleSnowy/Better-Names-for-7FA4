import { registerMessageRouter } from '../messaging/router.js';
import { syncAvatarBlockRule } from '../rules/avatar-block-rule.js';
import { initializeSubmitterState } from '../submitter/submitter-state.js';
import { loadBackgroundPreferences } from '../storage/preferences-repository.js';

export function bootstrapBackground() {
    // Placeholder bootstrap for the refactor scaffold.
    loadBackgroundPreferences();
    registerMessageRouter();
    syncAvatarBlockRule();
    initializeSubmitterState();
}
