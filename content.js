(() => {
    // Dedup: prevent double-fire from rapid key repeats or Commands API + content script
    const lastFired = new Map();
    const DEDUP_MS = 300;

    const sendAction = (action) => {
        if (!chrome.runtime?.id) {
            fallback(action);
            return;
        }

        chrome.runtime.sendMessage({ action }).catch(() => {
            // Service worker may have been dormant — retry once after wake-up
            setTimeout(() => {
                if (!chrome.runtime?.id) {
                    fallback(action);
                    return;
                }
                chrome.runtime.sendMessage({ action }).catch(() => fallback(action));
            }, 50);
        });
    };

    const fallback = (action) => {
        if (action === 'reload' || action === 'hardReload') {
            location.reload();
        } else if (action === 'closeTab') {
            window.close();
        }
    };

    const handleKey = (e) => {
        const actions = {
            'F1': 'closeTab',
            'F2': 'prevTab',
            'F3': 'nextTab',
            'F4': 'duplicateTab',
            'F5': e.shiftKey ? 'hardReload' : 'reload',
            'F6': 'reopenTab',
        };

        const action = actions[e.key];
        if (!action) return;

        // Dedup rapid fires
        const now = Date.now();
        if (lastFired.has(action) && now - lastFired.get(action) < DEDUP_MS) {
            e.preventDefault();
            return;
        }
        lastFired.set(action, now);

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        sendAction(action);
    };

    // Capture phase on window — earliest possible interception point
    window.addEventListener('keydown', handleKey, true);
})();
