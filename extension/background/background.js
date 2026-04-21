const INSTALLATION_FLAG = 'refactor.installationState';

chrome.runtime.onInstalled.addListener(async (details) => {
    const installedAt = new Date().toISOString();

    await chrome.storage.local.set({
        [INSTALLATION_FLAG]: {
            reason: details.reason,
            installedAt
        }
    });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== 'object') {
        return false;
    }

    if (message.type === 'refactor.getStatus') {
        chrome.storage.local.get([INSTALLATION_FLAG]).then((items) => {
            sendResponse({
                ok: true,
                installation: items[INSTALLATION_FLAG] || null
            });
        });
        return true;
    }

    if (message.type === 'refactor.ping') {
        sendResponse({
            ok: true,
            source: 'background'
        });
        return false;
    }

    return false;
});
