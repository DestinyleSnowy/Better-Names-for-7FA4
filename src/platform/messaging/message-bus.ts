import type { RuntimeMessage, RuntimeMessageResponse } from '@shared/contracts/messages';
import type { MessageBusContext } from '@shared/types/runtime';

export function createMessageBus() {
    return {
        async handle(message: RuntimeMessage, context: MessageBusContext): Promise<RuntimeMessageResponse> {
            switch (message.type) {
                case 'worker.ping':
                    return {
                        ok: true,
                        source: 'worker'
                    };
                case 'worker.get-platform-state':
                    return {
                        ok: true,
                        source: 'worker',
                        payload: {
                            platform: context.platformState,
                            storage: await context.storageService.read()
                        }
                    };
                default:
                    return {
                        ok: false,
                        source: 'worker',
                        error: `Unknown message type: ${(message as RuntimeMessage).type}`
                    };
            }
        }
    };
}
