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
    chrome.runtime.sendMessage({ action });
}, true);
