import type { WorkerAppDependencies } from '@shared/types/runtime';

export function createWorkerApp({
    storageService,
    messageBus,
    platformState
}: WorkerAppDependencies) {
    return {
        bootstrap() {
            chrome.runtime.onInstalled.addListener(async (details) => {
                await storageService.ensureMigrated();
                await storageService.patch({
                    platform: {
                        installedAt: new Date().toISOString(),
                        installReason: details.reason
                    }
                });
            });

            chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
                void messageBus.handle(message, {
                    storageService,
                    platformState
                }).then(sendResponse);

                return true;
            });
        }
    };
}
