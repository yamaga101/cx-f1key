(() => {
    const DEFAULT_BINDINGS = {
        closeTab:    { enabled: true, key: 'F1', modifiers: [] },
        prevTab:     { enabled: true, key: 'F2', modifiers: [] },
        nextTab:     { enabled: true, key: 'F3', modifiers: [] },
        reload:      { enabled: true, key: 'F5', modifiers: [] },
        hardReload:  { enabled: true, key: 'F5', modifiers: ['shift'] },
        reopenTab:   { enabled: true, key: 'F6', modifiers: [] },
    };

    const buildKeyMap = (bindings) => {
        const map = {};
        for (const [action, config] of Object.entries(bindings)) {
            if (!config.enabled) continue;
            const mods = [...(config.modifiers || [])].sort();
            const modStr = mods.join('+');
            const mapKey = modStr ? `${modStr}+${config.key}` : config.key;
            map[mapKey] = action;
        }
        return map;
    };

    const getKeyId = (e) => {
        const mods = [];
        if (e.shiftKey) mods.push('shift');
        if (e.ctrlKey) mods.push('ctrl');
        if (e.altKey) mods.push('alt');
        if (e.metaKey) mods.push('meta');
        mods.sort();
        const modStr = mods.join('+');
        return modStr ? `${modStr}+${e.key}` : e.key;
    };

    // Start with defaults, update when settings load
    let keyMap = buildKeyMap(DEFAULT_BINDINGS);

    if (chrome.storage?.local) {
        chrome.storage.local.get('bindings').then(result => {
            if (result.bindings) keyMap = buildKeyMap(result.bindings);
        }).catch(() => {});

        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local' && changes.bindings?.newValue) {
                keyMap = buildKeyMap(changes.bindings.newValue);
            }
        });
    }

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
        const keyId = getKeyId(e);
        const action = keyMap[keyId];
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
