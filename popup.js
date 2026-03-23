const DEFAULT_BINDINGS = {
  closeTab:    { enabled: true, key: 'F1', modifiers: [] },
  prevTab:     { enabled: true, key: 'F2', modifiers: [] },
  nextTab:     { enabled: true, key: 'F3', modifiers: [] },
  reload:      { enabled: true, key: 'F5', modifiers: [] },
  hardReload:  { enabled: true, key: 'F5', modifiers: ['shift'] },
  reopenTab:   { enabled: true, key: 'F6', modifiers: [] },
};

const ACTION_LABELS = {
  closeTab: 'タブを閉じる',
  prevTab: '前のタブ',
  nextTab: '次のタブ',
  reload: 'リロード',
  hardReload: '強制リロード',
  reopenTab: '閉じたタブを復活',
};

const ACTION_ORDER = ['closeTab', 'prevTab', 'nextTab', null, 'reload', 'hardReload', 'reopenTab'];
const MOD_SYMBOLS = { shift: '⇧', ctrl: '⌃', alt: '⌥', meta: '⌘' };
const KEY_DISPLAY = {
  ' ': 'Space', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Backspace: '⌫', Delete: '⌦', Enter: '↵', Tab: '⇥', Escape: 'Esc',
};

const formatKey = (key, modifiers = []) => {
  const parts = modifiers.map(m => MOD_SYMBOLS[m] || m);
  parts.push(KEY_DISPLAY[key] || key);
  return parts.join('');
};

let bindings = {};
let recordingHandler = null;
let recordingClickHandler = null;

const loadBindings = async () => {
  const result = await chrome.storage.local.get('bindings');
  bindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
  if (result.bindings) {
    for (const [action, config] of Object.entries(result.bindings)) {
      if (bindings[action]) bindings[action] = { ...bindings[action], ...config };
    }
  }
};

const saveBindings = () => chrome.storage.local.set({ bindings });

const cancelRecording = () => {
  if (recordingHandler) {
    document.removeEventListener('keydown', recordingHandler, true);
    recordingHandler = null;
  }
  if (recordingClickHandler) {
    document.removeEventListener('click', recordingClickHandler, true);
    recordingClickHandler = null;
  }
};

const startRecording = (action, badge) => {
  cancelRecording();
  badge.classList.add('recording');
  badge.textContent = '…';

  recordingHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
    if (e.key === 'Escape') { cancelRecording(); render(); return; }

    const modifiers = [];
    if (e.shiftKey) modifiers.push('shift');
    if (e.ctrlKey) modifiers.push('ctrl');
    if (e.altKey) modifiers.push('alt');
    if (e.metaKey) modifiers.push('meta');

    bindings[action].key = e.key;
    bindings[action].modifiers = modifiers;
    saveBindings();
    cancelRecording();
    render();
  };
  document.addEventListener('keydown', recordingHandler, true);

  setTimeout(() => {
    recordingClickHandler = (e) => {
      if (e.target !== badge) { cancelRecording(); render(); }
    };
    document.addEventListener('click', recordingClickHandler, true);
  }, 0);
};

const render = () => {
  const container = document.getElementById('bindings');
  container.innerHTML = '';

  for (const action of ACTION_ORDER) {
    if (action === null) { container.appendChild(document.createElement('hr')); continue; }
    const config = bindings[action];

    const row = document.createElement('div');
    row.className = 'row' + (config.enabled ? '' : ' disabled');

    const toggle = document.createElement('label');
    toggle.className = 'toggle';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = config.enabled;
    input.addEventListener('change', () => {
      bindings[action].enabled = input.checked;
      row.className = 'row' + (input.checked ? '' : ' disabled');
      saveBindings();
    });
    const slider = document.createElement('span');
    slider.className = 'slider';
    toggle.appendChild(input);
    toggle.appendChild(slider);

    const keyBadge = document.createElement('button');
    keyBadge.className = 'key';
    keyBadge.textContent = formatKey(config.key, config.modifiers);
    keyBadge.addEventListener('click', (e) => { e.stopPropagation(); startRecording(action, keyBadge); });

    const desc = document.createElement('span');
    desc.className = 'desc';
    desc.textContent = ACTION_LABELS[action];

    row.appendChild(toggle);
    row.appendChild(keyBadge);
    row.appendChild(desc);
    container.appendChild(row);
  }
};

loadBindings().then(render);

document.getElementById('resetBtn').addEventListener('click', () => {
  bindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
  saveBindings();
  render();
});

document.getElementById('shortcuts').addEventListener('click', () => {
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

document.getElementById('debugBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('debug.html') });
});

document.getElementById('updateBtn').addEventListener('click', async () => {
  const btn = document.getElementById('updateBtn');
  btn.textContent = '⏳'; btn.style.pointerEvents = 'none';
  try {
    const response = await chrome.runtime.sendNativeMessage('com.yamaga101.gitpull', { repo: 'cx-f1key' });
    btn.textContent = response.success ? '✅' : '❌';
    btn.title = response.output || '';
  } catch (e) {
    btn.textContent = '❌';
    btn.title = e.message || 'Native host not installed';
  }
  setTimeout(() => { btn.textContent = '🔄'; btn.style.pointerEvents = ''; btn.title = 'git pull で最新に更新'; }, 3000);
});
