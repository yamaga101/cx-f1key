(() => {
    const EXT = 'cx-f1key';

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

    let keyMap = buildKeyMap(DEFAULT_BINDINGS);
    let debugMode = false;

    // Debug logging (console only when enabled)
    const dbg = (...args) => {
        if (debugMode) console.log(`[${EXT}]`, ...args);
    };

    // Load settings
    if (chrome.storage?.local) {
        chrome.storage.local.get(['bindings', 'debugEnabled']).then(result => {
            if (result.bindings) keyMap = buildKeyMap(result.bindings);
            debugMode = !!result.debugEnabled;
            dbg('loaded', { url: location.href, frame: window === window.top ? 'top' : 'iframe' });
        }).catch(() => {});

        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== 'local') return;
            if (changes.bindings?.newValue) {
                keyMap = buildKeyMap(changes.bindings.newValue);
                dbg('bindings updated');
            }
            if (changes.debugEnabled) {
                debugMode = !!changes.debugEnabled.newValue;
            }
        });
    }

    // Dedup: prevent double-fire from rapid key repeats or Commands API + content script
    const lastFired = new Map();
    const DEDUP_MS = 300;

    // Retry delays for service worker wake-up (3 attempts)
    const RETRY_DELAYS = [0, 100, 500];

    // Toast notification for connection errors (top-frame only)
    const showToast = (msg, type = 'error') => {
        if (window !== window.top) return;
        const el = document.createElement('div');
        el.textContent = msg;
        const bg = type === 'warn' ? '#e67e22' : '#e74c3c';
        el.style.cssText = `position:fixed;top:12px;right:12px;z-index:2147483647;padding:8px 16px;border-radius:6px;font-size:13px;font-family:-apple-system,sans-serif;color:#fff;background:${bg};box-shadow:0 2px 8px rgba(0,0,0,.3);transition:opacity .3s;pointer-events:none;`;
        (document.body || document.documentElement).appendChild(el);
        setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 4000);
    };

    const sendAction = (action) => {
        const attempt = (i) => {
            // Extension context invalidated (extension updated/reloaded)
            if (!chrome.runtime?.id) {
                dbg('context invalidated', { action, attempt: i });
                if (action === 'reload' || action === 'hardReload') {
                    location.reload();
                } else {
                    showToast('拡張が更新されました。ページを再読み込みしてください', 'warn');
                }
                return;
            }

            chrome.runtime.sendMessage({ action }).then(() => {
                dbg('sent ok', { action, attempt: i });
            }).catch((err) => {
                dbg('send failed', { action, attempt: i, error: err.message });
                if (i < RETRY_DELAYS.length - 1) {
                    setTimeout(() => attempt(i + 1), RETRY_DELAYS[i + 1]);
                } else {
                    // All retries exhausted — only reload actions can fallback
                    if (action === 'reload' || action === 'hardReload') {
                        location.reload();
                    } else {
                        showToast('キー操作に失敗。ページを再読み込みしてください', 'error');
                    }
                }
            });
        };

        attempt(0);
    };

    const handleKey = (e) => {
        const keyId = getKeyId(e);
        const action = keyMap[keyId];

        // Debug: log all F-key presses even if not mapped
        if (debugMode && e.key.startsWith('F') && e.key.length <= 3) {
            dbg('keydown', { keyId, action: action || 'unmapped', target: e.target.tagName });
        }

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
