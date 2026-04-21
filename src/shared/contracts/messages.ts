export type RuntimeMessage =
    | { type: 'worker.ping' }
    | { type: 'worker.get-platform-state' };

export interface RuntimeMessageResponse {
    ok: boolean;
    source: 'worker';
    payload?: unknown;
    error?: string;
}
