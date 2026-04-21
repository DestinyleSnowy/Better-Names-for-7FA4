import type { RuntimeMessage, RuntimeMessageResponse } from '@shared/contracts/messages';

export interface DomAdapter {
    root: Document;
    ready(): Promise<void>;
    query<T extends Element>(selector: string): T | null;
    ensureRoot(id: string): HTMLElement;
}

export interface ExtensionApiAdapter {
    getUrl(path: string): string;
    sendMessage<T extends RuntimeMessageResponse>(message: RuntimeMessage): Promise<T>;
}

export interface StorageAdapter {
    get<T>(key: string): Promise<T | undefined>;
    set(key: string, value: unknown): Promise<void>;
}
