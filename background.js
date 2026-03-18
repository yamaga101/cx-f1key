// === Commands API handler (browser-level, works on all pages including chrome://) ===
chrome.commands.onCommand.addListener((command) => {
    switch (command) {
        case 'close-tab':
            chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
                if (tab) chrome.tabs.remove(tab.id);
            });
            break;

        case 'prev-tab':
            chrome.tabs.query({ currentWindow: true }, (tabs) => {
                const idx = tabs.findIndex(t => t.active);
                const prev = tabs[(idx - 1 + tabs.length) % tabs.length];
                chrome.tabs.update(prev.id, { active: true });
            });
            break;

        case 'next-tab':
            chrome.tabs.query({ currentWindow: true }, (tabs) => {
                const idx = tabs.findIndex(t => t.active);
                const next = tabs[(idx + 1) % tabs.length];
                chrome.tabs.update(next.id, { active: true });
            });
            break;

        case 'reopen-tab':
            chrome.sessions.restore();
            break;

        case 'reload-tab':
            chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
                if (tab) chrome.tabs.reload(tab.id);
            });
            break;

        case 'hard-reload-tab':
            chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
                if (tab) chrome.tabs.reload(tab.id, { bypassCache: true });
            });
            break;
    }
});

// === Content script message handler (fallback for regular web pages) ===
chrome.runtime.onMessage.addListener((message, sender) => {
    const tab = sender.tab;
    if (!tab) return;

    switch (message.action) {
        case 'closeTab':
            chrome.tabs.remove(tab.id);
            break;

        case 'prevTab':
            chrome.tabs.query({ currentWindow: true }, (tabs) => {
                const idx = tabs.findIndex(t => t.id === tab.id);
                const prev = tabs[(idx - 1 + tabs.length) % tabs.length];
                chrome.tabs.update(prev.id, { active: true });
            });
            break;

        case 'nextTab':
            chrome.tabs.query({ currentWindow: true }, (tabs) => {
                const idx = tabs.findIndex(t => t.id === tab.id);
                const next = tabs[(idx + 1) % tabs.length];
                chrome.tabs.update(next.id, { active: true });
            });
            break;

        case 'reload':
            chrome.tabs.reload(tab.id);
            break;

        case 'hardReload':
            chrome.tabs.reload(tab.id, { bypassCache: true });
            break;

        case 'reopenTab':
            chrome.sessions.restore();
            break;
    }
});
