document.addEventListener('keydown', (e) => {
    const actions = {
        'F1': 'closeTab',
        'F2': 'prevTab',
        'F3': 'nextTab',
        'F5': e.shiftKey ? 'hardReload' : 'reload',
        'F6': 'reopenTab',
    };

    const action = actions[e.key];
    if (!action) return;

    e.preventDefault();
    e.stopPropagation();

    // Extension context invalidated (after extension reload)
    if (!chrome.runtime?.id) {
        if (action === 'reload' || action === 'hardReload') {
            location.reload();
        }
        return;
    }

    chrome.runtime.sendMessage({ action }).catch(() => {
        if (action === 'reload' || action === 'hardReload') {
            location.reload();
        }
    });
}, true);
