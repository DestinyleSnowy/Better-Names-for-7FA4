export function createBackgroundRequestService() {
    // TODO: wrap cross-origin fetch and request fallback logic here.
    return {
        async request() {
            throw new Error('Not implemented');
        }
    };
}
