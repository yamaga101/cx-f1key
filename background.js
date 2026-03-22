importScripts('auto-reload.js');

// === Debug ===
const SW_START = Date.now();
const DEBUG_LOG_MAX = 200;
const actionLog = [];

const logAction = (entry) => {
    actionLog.push({ ts: Date.now(), ...entry });
    if (actionLog.length > DEBUG_LOG_MAX) actionLog.splice(0, actionLog.length - DEBUG_LOG_MAX);
};

// === Settings ===
const DEFAULT_BINDINGS = {
    closeTab:    { enabled: true, key: 'F1', modifiers: [] },
    prevTab:     { enabled: true, key: 'F2', modifiers: [] },
    nextTab:     { enabled: true, key: 'F3', modifiers: [] },
    reload:      { enabled: true, key: 'F5', modifiers: [] },
    hardReload:  { enabled: true, key: 'F5', modifiers: ['shift'] },
    reopenTab:   { enabled: true, key: 'F6', modifiers: [] },
};

let currentBindings = null;

const loadBindings = async () => {
    try {
        const result = await chrome.storage.local.get('bindings');
        currentBindings = result.bindings || DEFAULT_BINDINGS;
    } catch {
        currentBindings = DEFAULT_BINDINGS;
    }
};

loadBindings();

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.bindings?.newValue) {
        currentBindings = changes.bindings.newValue;
    }
});

const isActionEnabled = (action) => {
    if (!currentBindings) return true;
    const binding = currentBindings[action];
    return binding ? binding.enabled : true;
};

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

const executeAction = async (action, tabId, source) => {
    // Normalize kebab-case (Commands API) to camelCase (content script)
    const normalized = action.replace(/-./g, c => c[1].toUpperCase());

    // Check if action is enabled in settings
    if (!isActionEnabled(normalized)) {
        logAction({ action: normalized, source, result: 'disabled' });
        return;
    }

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
            case 'reload':
                if (tabId) await chrome.tabs.reload(tabId);
                break;

            case 'hardReloadTab':
            case 'hardReload':
                if (tabId) await chrome.tabs.reload(tabId, { bypassCache: true });
                break;
        }
        logAction({ action: normalized, source, tabId, result: 'ok' });
    } catch (e) {
        logAction({ action: normalized, source, tabId, result: 'error', error: e.message });
    }
};

// === Commands API handler (works on ALL pages including chrome://) ===
chrome.commands.onCommand.addListener(async (command) => {
    if (isDuplicate(command)) {
        logAction({ action: command, source: 'commands', result: 'dedup' });
        return;
    }
    const tab = await getActiveTab();
    if (tab) await executeAction(command, tab.id, 'commands');
});

// === Message handler ===
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Ping for health check
    if (message.type === 'ping') {
        sendResponse({ pong: true, uptime: Date.now() - SW_START });
        return;
    }

    // Debug info request
    if (message.type === 'getDebugInfo') {
        sendResponse({
            swStart: SW_START,
            uptime: Date.now() - SW_START,
            version: chrome.runtime.getManifest().version,
            bindings: currentBindings,
            actionLog: actionLog.slice(-50),
        });
        return;
    }

    // Clear debug log
    if (message.type === 'clearDebugLog') {
        actionLog.length = 0;
        sendResponse({ ok: true });
        return;
    }

    // Normal action from content script
    if (!message.action || !sender.tab) return;
    if (isDuplicate(message.action)) {
        logAction({ action: message.action, source: 'content', result: 'dedup' });
        return;
    }
    executeAction(message.action, sender.tab.id, 'content');
});
