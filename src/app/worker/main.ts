import { createExtensionApiAdapter } from '@adapters/api/extension-api-adapter';
import { createChromeStorageAdapter } from '@adapters/storage/chrome-storage-adapter';
import { createWorkerApp } from '@app/worker/worker-app';
import { createMessageBus } from '@platform/messaging/message-bus';
import { createStorageService } from '@platform/storage/storage-service';
import { createPlatformState } from '@platform/browser/platform-state';
import { STORAGE_DEFAULTS } from '@config/defaults/storage-defaults';
import { STORAGE_MIGRATIONS } from '@config/migration/storage-migrations';

const workerApp = createWorkerApp({
    api: createExtensionApiAdapter(),
    storageService: createStorageService({
        storage: createChromeStorageAdapter(),
        defaults: STORAGE_DEFAULTS,
        migrations: STORAGE_MIGRATIONS
    }),
    messageBus: createMessageBus(),
    platformState: createPlatformState()
});

workerApp.bootstrap();
