export function createPlatformState() {
    return {
        userAgent: globalThis.navigator?.userAgent ?? 'worker',
        runtime: 'mv3'
    };
}
