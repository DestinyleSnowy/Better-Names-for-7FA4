import type { RuntimeMessageResponse } from '@shared/contracts/messages';
import type { PopupAppDependencies } from '@shared/types/runtime';

export function createPopupApp({ api }: PopupAppDependencies) {
    return {
        async mount(root: HTMLElement | null) {
            if (!root) {
                return;
            }

            root.innerHTML = `
                <main class="popup-shell">
                    <p class="popup-eyebrow">Better Names for 7FA4</p>
                    <h1 class="popup-title">Refactor Scaffold</h1>
                    <p class="popup-copy">MV3 + TypeScript + content-app + feature registration</p>
                    <pre class="popup-output" id="popup-output">Loading worker status...</pre>
                </main>
            `;

            const output = root.querySelector<HTMLPreElement>('#popup-output');
            if (!output) {
                return;
            }

            const response = await api.sendMessage<RuntimeMessageResponse>({
                type: 'worker.get-platform-state'
            });

            output.textContent = JSON.stringify(response, null, 2);
        }
    };
}
