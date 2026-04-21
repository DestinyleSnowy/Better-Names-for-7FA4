import { createDomAdapter } from '@adapters/dom/page-dom-adapter';
import { createExtensionApiAdapter } from '@adapters/api/extension-api-adapter';
import { createChromeStorageAdapter } from '@adapters/storage/chrome-storage-adapter';
import { createContentApp } from '@app/content/composition/create-content-app';
import { resolvePageRoute } from '@app/content/routes/resolve-page-route';

const contentApp = createContentApp({
    route: resolvePageRoute(window.location),
    dom: createDomAdapter(document),
    api: createExtensionApiAdapter(),
    storage: createChromeStorageAdapter()
});

void contentApp.mount();
