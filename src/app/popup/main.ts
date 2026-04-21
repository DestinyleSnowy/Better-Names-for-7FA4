import { createExtensionApiAdapter } from '@adapters/api/extension-api-adapter';
import { createPopupApp } from '@app/popup/popup-app';

const popupApp = createPopupApp({
    api: createExtensionApiAdapter()
});

void popupApp.mount(document.getElementById('app'));
