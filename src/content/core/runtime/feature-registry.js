export function createFeatureRegistry(context) {
    const features = [];

    return {
        context,
        register(name, definition) {
            features.push({ name, definition });
        },
        list() {
            return [...features];
        }
    };
}
