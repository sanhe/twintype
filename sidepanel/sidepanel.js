// TwinType Side Panel Logic

// DOM Elements
const elements = {
  masterInput: document.getElementById('masterInput'),
  charCount: document.getElementById('charCount'),
  liveSyncToggle: document.getElementById('liveSyncToggle'),
  syncHint: document.getElementById('syncHint'),
  syncNowBtn: document.getElementById('syncNowBtn'),
  clearBtn: document.getElementById('clearBtn'),
  sendBtn: document.getElementById('sendBtn'),
  refreshBtn: document.getElementById('refreshBtn'),
  themeToggle: document.getElementById('themeToggle'),
  toastContainer: document.getElementById('toastContainer'),
  diagToggle: document.getElementById('diagToggle'),
  diagArrow: document.getElementById('diagArrow'),
  diagContent: document.getElementById('diagContent'),
  diagLog: document.getElementById('diagLog'),
  selectTargetA: document.getElementById('selectTargetA'),
  selectTargetB: document.getElementById('selectTargetB'),
  statusDotA: document.getElementById('statusDotA'),
  statusDotB: document.getElementById('statusDotB')
};

// State
const state = {
  eligibleTabs: [],
  selectedTargetA: null,
  selectedTargetB: null,
  diagnostics: [],
  debounceTimer: null
};

// Constants
const DEBOUNCE_MS = 100;
const MAX_TEXT_LENGTH = 100000;
const MAX_DIAG_ENTRIES = 20;

async function init() {
  try {
    chrome.runtime.sendMessage({ type: 'SIDEPANEL_CONNECT' }).catch(() => {});

    const stored = await chrome.storage.local.get([
      'liveSync', 'theme', 'inputText', 'selectedTargetA', 'selectedTargetB'
    ]);

    // Apply theme
    if (stored.theme === 'light') document.body.classList.add('light');
    if (stored.theme === 'dark') document.body.classList.add('dark');

    // Restore text
    if (stored.inputText) {
      elements.masterInput.value = stored.inputText.slice(0, MAX_TEXT_LENGTH);
      updateCharCount();
    }

    // Restore sync state
    elements.liveSyncToggle.checked = stored.liveSync !== false;
    updateSyncUI();

    // Restore target selections
    if (stored.selectedTargetA) state.selectedTargetA = parseInt(stored.selectedTargetA);
    if (stored.selectedTargetB) state.selectedTargetB = parseInt(stored.selectedTargetB);

    await fetchAndPopulateTabs();
    setupEventListeners();

    // Periodic status updates
    setInterval(updateTargetStatuses, 5000);
  } catch (err) {
    console.error('Init failed:', err);
    addDiagnostic({ type: 'error', message: `Init error: ${err.message}` });
  }
}

function setupEventListeners() {
  elements.selectTargetA.addEventListener('change', handleTargetChange);
  elements.selectTargetB.addEventListener('change', handleTargetChange);

  elements.masterInput.addEventListener('input', () => {
    updateCharCount();
    if (elements.liveSyncToggle.checked) {
      clearTimeout(state.debounceTimer);
      state.debounceTimer = setTimeout(syncText, DEBOUNCE_MS);
    }
  });

  elements.masterInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendAll();
    }
  });

  elements.liveSyncToggle.addEventListener('change', () => {
    chrome.storage.local.set({ liveSync: elements.liveSyncToggle.checked });
    updateSyncUI();
  });

  elements.syncNowBtn.addEventListener('click', syncText);

  elements.clearBtn.addEventListener('click', () => {
    elements.masterInput.value = '';
    updateCharCount();
    chrome.storage.local.set({ inputText: '' });
    showToast('Cleared', 'success');
  });

  elements.sendBtn.addEventListener('click', sendAll);
  elements.refreshBtn.addEventListener('click', fetchAndPopulateTabs);
  elements.themeToggle.addEventListener('click', cycleTheme);

  elements.diagToggle.addEventListener('click', () => {
    elements.diagContent.classList.toggle('visible');
    elements.diagArrow.classList.toggle('expanded');
  });
}

async function fetchAndPopulateTabs() {
  elements.refreshBtn.classList.add('spinning');

  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_ELIGIBLE_TABS' });
    state.eligibleTabs = response.tabs || [];

    populateSelect(elements.selectTargetA, state.selectedTargetA, false);
    populateSelect(elements.selectTargetB, state.selectedTargetB, true);

    validateSelections();
    updateTargetStatuses();

    addDiagnostic({ type: 'success', message: `Fetched ${state.eligibleTabs.length} eligible tabs` });
  } catch (err) {
    addDiagnostic({ type: 'error', message: `Fetch tabs failed: ${err.message}` });
  }

  setTimeout(() => elements.refreshBtn.classList.remove('spinning'), 500);
}

function populateSelect(selectEl, currentSelectionId, includeNone) {
  selectEl.innerHTML = '';

  if (includeNone) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'None';
    selectEl.appendChild(opt);
  }

  if (state.eligibleTabs.length === 0) {
    const opt = document.createElement('option');
    opt.disabled = true;
    opt.textContent = 'No eligible tabs found';
    selectEl.appendChild(opt);
    return;
  }

  for (const tab of state.eligibleTabs) {
    const opt = document.createElement('option');
    opt.value = tab.id;
    const prov = tab.provider.toUpperCase().substring(0, 3);
    const title = tab.title.length > 25 ? tab.title.substring(0, 25) + '...' : tab.title;
    opt.textContent = `[${prov}] ${title} (Win ${tab.windowId})`;
    selectEl.appendChild(opt);
  }

  // Restore selection if valid
  if (currentSelectionId && state.eligibleTabs.find(t => t.id === currentSelectionId)) {
    selectEl.value = currentSelectionId;
  } else if (!includeNone && state.eligibleTabs.length > 0) {
    selectEl.value = state.eligibleTabs[0].id;
    handleTargetChange();
  } else {
    selectEl.value = '';
  }
}

function validateSelections() {
  const newA = parseInt(elements.selectTargetA.value) || null;
  const newB = parseInt(elements.selectTargetB.value) || null;

  if (state.selectedTargetA && !newA && state.eligibleTabs.length === 0) {
    state.selectedTargetA = null;
    chrome.storage.local.remove('selectedTargetA');
  } else if (newA) {
    state.selectedTargetA = newA;
  }

  if (state.selectedTargetB && !newB) {
    state.selectedTargetB = null;
    chrome.storage.local.remove('selectedTargetB');
  } else if (newB) {
    state.selectedTargetB = newB;
  }
}

function handleTargetChange() {
  state.selectedTargetA = parseInt(elements.selectTargetA.value) || null;
  state.selectedTargetB = parseInt(elements.selectTargetB.value) || null;

  chrome.storage.local.set({
    selectedTargetA: state.selectedTargetA,
    selectedTargetB: state.selectedTargetB
  });

  updateTargetStatuses();
}

async function updateTargetStatuses() {
  await Promise.all([
    updateDot(elements.statusDotA, state.selectedTargetA),
    updateDot(elements.statusDotB, state.selectedTargetB)
  ]);
}

async function updateDot(dotEl, tabId) {
  if (!tabId) {
    dotEl.className = 'status-dot-wrapper gray';
    return;
  }

  const tabInfo = state.eligibleTabs.find(t => t.id === tabId);
  const tabUrl = tabInfo?.url || null;

  try {
    const res = await chrome.runtime.sendMessage({
      type: 'PING_TAB',
      tabId,
      tabUrl
    });

    if (res?.ready) {
      dotEl.className = 'status-dot-wrapper green';
      dotEl.title = 'Ready';
    } else {
      dotEl.className = 'status-dot-wrapper red';
      dotEl.title = res?.reason || 'Not connected';
    }
  } catch (e) {
    dotEl.className = 'status-dot-wrapper red';
    dotEl.title = 'Connection failed';
  }
}

function getTargets() {
  const targets = [];
  if (state.selectedTargetA) targets.push(state.selectedTargetA);
  if (state.selectedTargetB && state.selectedTargetB !== state.selectedTargetA) {
    targets.push(state.selectedTargetB);
  }
  return targets;
}

function addDiagnostic(entry) {
  const timestamp = new Date().toLocaleTimeString();
  state.diagnostics.unshift({ ...entry, timestamp });
  if (state.diagnostics.length > MAX_DIAG_ENTRIES) state.diagnostics.pop();

  if (state.diagnostics.length === 0) {
    elements.diagLog.innerHTML = 'No diagnostics yet';
    return;
  }

  elements.diagLog.innerHTML = state.diagnostics.map(d => {
    const cls = d.type === 'error' ? 'diag-error' : d.type === 'success' ? 'diag-success' : '';
    return `<div class="diag-entry ${cls}">[${d.timestamp}] ${d.message}</div>`;
  }).join('');
}

async function syncText() {
  const text = elements.masterInput.value;
  if (text.length > MAX_TEXT_LENGTH) {
    showToast('Text too long (100kb limit)', 'warning');
    return;
  }

  chrome.storage.local.set({ inputText: text });

  const targets = getTargets();
  if (targets.length === 0) return;

  for (const tabId of targets) {
    const tabInfo = state.eligibleTabs.find(t => t.id === tabId);
    if (!tabInfo) continue;

    chrome.runtime.sendMessage({ type: 'SET_TEXT', tabId, text, tabUrl: tabInfo.url })
      .then(res => {
        if (!res.ok) {
          addDiagnostic({ type: 'error', message: `Sync failed (Tab ${tabId}): ${res.error}` });
          updateTargetStatuses();
        }
      })
      .catch(() => {});
  }
}

async function sendAll() {
  await syncText();
  await new Promise(r => setTimeout(r, 100));

  const targets = getTargets();
  if (targets.length === 0) {
    showToast('No targets selected', 'warning');
    return;
  }

  let sentCount = 0;

  for (const tabId of targets) {
    try {
      const res = await chrome.runtime.sendMessage({ type: 'SEND_COMMAND', tabId });
      if (res.ok) {
        sentCount++;
      } else {
        addDiagnostic({ type: 'error', message: `Send failed (Tab ${tabId}): ${res.error}` });
      }
    } catch (e) {
      addDiagnostic({ type: 'error', message: `Send exception (Tab ${tabId}): ${e.message}` });
    }
  }

  if (sentCount > 0) {
    showToast(`Sent to ${sentCount} target(s)`, 'success');
    elements.masterInput.value = '';
    updateCharCount();
    chrome.storage.local.set({ inputText: '' });
  } else {
    showToast('Failed to send to targets', 'error');
  }

  updateTargetStatuses();
}

function updateCharCount() {
  elements.charCount.textContent = elements.masterInput.value.length;
}

function updateSyncUI() {
  const isLive = elements.liveSyncToggle.checked;
  elements.syncHint.textContent = isLive ? 'Mirrors as you type' : 'Click "Sync Now" to mirror';
  elements.syncNowBtn.style.display = isLive ? 'none' : 'flex';
}

function showToast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  elements.toastContainer.appendChild(el);

  setTimeout(() => {
    el.classList.add('fade-out');
    setTimeout(() => el.remove(), 300);
  }, 2500);
}

function cycleTheme() {
  const hasDark = document.body.classList.contains('dark');
  const hasLight = document.body.classList.contains('light');

  if (!hasDark && !hasLight) {
    document.body.classList.add('light');
    chrome.storage.local.set({ theme: 'light' });
  } else if (hasLight) {
    document.body.classList.remove('light');
    document.body.classList.add('dark');
    chrome.storage.local.set({ theme: 'dark' });
  } else {
    document.body.classList.remove('dark');
    chrome.storage.local.remove('theme');
  }
}

init();
