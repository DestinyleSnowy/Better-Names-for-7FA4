import type { DomAdapter } from '@shared/contracts/adapters';

export function createDomAdapter(root: Document): DomAdapter {
    return {
        root,
        async ready() {
            if (root.readyState !== 'loading') {
                return;
            }

            await new Promise<void>((resolve) => {
                root.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
            });
        },
        query<T extends Element>(selector: string) {
            return root.querySelector<T>(selector);
        },
        ensureRoot(id: string) {
            const existing = root.getElementById(id);
            if (existing) {
                return existing;
            }

            const host = root.createElement('div');
            host.id = id;
            root.documentElement.appendChild(host);
            return host;
        }
    };
}
