import { createPanelRuntime } from '../services/panel-runtime.js';
import { createPanelStore } from '../state/panel-store.js';

export function bootstrapPanel() {
    const store = createPanelStore();
    const runtime = createPanelRuntime(store);

    return { store, runtime };
}
