import { createPopupStore } from '../state/popup-store.js';
import { createSubmitterClient } from '../services/submitter-client.js';

export function bootstrapPopup() {
    const store = createPopupStore();
    const client = createSubmitterClient();

    return { store, client };
}
