export function createSubmitterClient() {
    return {
        async sync() {
            throw new Error('Not implemented');
        }
    };
}
