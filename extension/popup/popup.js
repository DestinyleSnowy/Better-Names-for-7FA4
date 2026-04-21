const statusOutput = document.getElementById('statusOutput');
const refreshButton = document.getElementById('refreshStatus');

async function refreshStatus() {
    statusOutput.textContent = 'Loading background status...';

    try {
        const response = await chrome.runtime.sendMessage({ type: 'refactor.getStatus' });
        statusOutput.textContent = JSON.stringify(response, null, 2);
    } catch (error) {
        statusOutput.textContent = `Failed to reach background worker.\n${String(error)}`;
    }
}

refreshButton.addEventListener('click', refreshStatus);
void refreshStatus();
