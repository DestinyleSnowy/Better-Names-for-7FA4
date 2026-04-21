(function () {
    const ROOT_ID = 'bn-refactor-root';

    function createRoot() {
        const existing = document.getElementById(ROOT_ID);
        if (existing) {
            return existing;
        }

        const host = document.createElement('aside');
        host.id = ROOT_ID;
        host.innerHTML = `
            <div class="bn-refactor-card">
                <div class="bn-refactor-eyebrow">Ground-up refactor</div>
                <h2 class="bn-refactor-title">Better Names for 7FA4</h2>
                <p class="bn-refactor-copy">
                    This browser extension is now running from the new refactor scaffold,
                    not from the legacy release folder.
                </p>
                <div class="bn-refactor-meta">
                    <span class="bn-refactor-pill">MV3</span>
                    <span class="bn-refactor-pill">Root-loaded</span>
                    <span class="bn-refactor-pill">No legacy runtime dependency</span>
                </div>
            </div>
        `;

        document.documentElement.appendChild(host);
        return host;
    }

    function bootstrapContentScript() {
        createRoot();

        chrome.runtime.sendMessage({ type: 'refactor.ping' }).catch(() => {
            // Ignore if the worker is still spinning up.
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrapContentScript, { once: true });
        return;
    }

    bootstrapContentScript();
})();
