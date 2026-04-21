export function createDomContext(root) {
    return {
        root,
        query(selector) {
            return root.querySelector(selector);
        },
        queryAll(selector) {
            return [...root.querySelectorAll(selector)];
        }
    };
}
