importScripts('auto-reload.js');

// === Dedup: Commands API + content script can both fire ===
const recentActions = new Map();
const DEDUP_MS = 500;

const isDuplicate = (action) => {
    const now = Date.now();
    // Normalize: Commands API uses 'close-tab', content script uses 'closeTab'
    const key = action.replace(/-./g, c => c[1].toUpperCase());
    if (recentActions.has(key) && now - recentActions.get(key) < DEDUP_MS) return true;
    recentActions.set(key, now);
    return false;
};

const getActiveTab = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
};

const getAllTabs = () => chrome.tabs.query({ currentWindow: true });

const executeAction = async (action, tabId) => {
    // Normalize kebab-case (Commands API) to camelCase (content script)
    const normalized = action.replace(/-./g, c => c[1].toUpperCase());

    try {
        switch (normalized) {
            case 'closeTab':
                if (tabId) await chrome.tabs.remove(tabId);
                break;

            case 'prevTab': {
                const tabs = await getAllTabs();
                const idx = tabs.findIndex(t => t.active);
                const prev = tabs[(idx - 1 + tabs.length) % tabs.length];
                await chrome.tabs.update(prev.id, { active: true });
                break;
            }

            case 'nextTab': {
                const tabs = await getAllTabs();
                const idx = tabs.findIndex(t => t.active);
                const next = tabs[(idx + 1) % tabs.length];
                await chrome.tabs.update(next.id, { active: true });
                break;
            }

            case 'reopenTab':
                await chrome.sessions.restore();
                break;

            case 'reloadTab':
                if (tabId) await chrome.tabs.reload(tabId);
                break;

            case 'hardReloadTab':
                if (tabId) await chrome.tabs.reload(tabId, { bypassCache: true });
                break;
        }
    } catch (e) {
        // Tab may have been closed/navigated before action completed — ignore
    }
};

// === Commands API handler (works on ALL pages including chrome://) ===
chrome.commands.onCommand.addListener(async (command) => {
    if (isDuplicate(command)) return;
    const tab = await getActiveTab();
    if (tab) await executeAction(command, tab.id);
});

// === Content script message handler (fallback for regular web pages) ===
chrome.runtime.onMessage.addListener((message, sender) => {
    if (!message.action || !sender.tab) return;
    if (isDuplicate(message.action)) return;
    executeAction(message.action, sender.tab.id);
});
