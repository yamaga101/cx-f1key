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
