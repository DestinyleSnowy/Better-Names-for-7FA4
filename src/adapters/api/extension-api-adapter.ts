import type { ExtensionApiAdapter } from '@shared/contracts/adapters';
import type { RuntimeMessage, RuntimeMessageResponse } from '@shared/contracts/messages';

export function createExtensionApiAdapter(): ExtensionApiAdapter {
    return {
        getUrl(path: string) {
            return chrome.runtime.getURL(path);
        },
        async sendMessage<T extends RuntimeMessageResponse>(message: RuntimeMessage): Promise<T> {
            return chrome.runtime.sendMessage(message) as Promise<T>;
        }
    };
}
