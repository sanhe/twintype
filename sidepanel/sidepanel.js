// TwinType Side Panel Logic (Explicit Targeting)

// DOM Elements
const masterInput = document.getElementById('masterInput');
const charCount = document.getElementById('charCount');
const liveSyncToggle = document.getElementById('liveSyncToggle');
const syncHint = document.getElementById('syncHint');
const syncNowBtn = document.getElementById('syncNowBtn');
const clearBtn = document.getElementById('clearBtn');
const sendBtn = document.getElementById('sendBtn');
const refreshBtn = document.getElementById('refreshBtn');
const themeToggle = document.getElementById('themeToggle');
const toastContainer = document.getElementById('toastContainer');
const diagToggle = document.getElementById('diagToggle');
const diagArrow = document.getElementById('diagArrow');
const diagContent = document.getElementById('diagContent');
const diagLog = document.getElementById('diagLog');

// Select Elements
const selectTargetA = document.getElementById('selectTargetA');
const selectTargetB = document.getElementById('selectTargetB');
const statusDotA = document.getElementById('statusDotA');
const statusDotB = document.getElementById('statusDotB');

// State
let eligibleTabs = [];
let selectedTargetA = null;
let selectedTargetB = null;
let diagnostics = [];
let debounceTimer = null;
const DEBOUNCE_MS = 100;
const MAX_TEXT_LENGTH = 100000;
const MAX_DIAG_ENTRIES = 20;

// Initialize
async function init() {
  try {
    // Notify background
    chrome.runtime.sendMessage({ type: 'SIDEPANEL_CONNECT' }).catch(() => { });

    // Load settings
    const stored = await chrome.storage.local.get(['liveSync', 'theme', 'inputText', 'selectedTargetA', 'selectedTargetB']);

    // Theme (Light/Dark/System)
    if (stored.theme === 'light') document.body.classList.add('light');
    if (stored.theme === 'dark') document.body.classList.add('dark');

    // Restore text
    if (stored.inputText) {
      masterInput.value = stored.inputText.slice(0, MAX_TEXT_LENGTH);
      updateCharCount();
    }

    // Restore Sync State
    liveSyncToggle.checked = stored.liveSync !== false;
    updateSyncUI();

    // Restore Targets (IDs)
    if (stored.selectedTargetA) selectedTargetA = parseInt(stored.selectedTargetA);
    if (stored.selectedTargetB) selectedTargetB = parseInt(stored.selectedTargetB);

    // Initial Fetch
    await fetchAndPopulateTabs();

    // Set listeners
    selectTargetA.addEventListener('change', handleTargetChange);
    selectTargetB.addEventListener('change', handleTargetChange);

    // Periodic ping to keep dots updated
    setInterval(updateTargetStatuses, 5000);

  } catch (err) {
    console.error('Init failed:', err);
    addDiagnostic({ type: 'error', message: `Init error: ${err.message}` });
  }
}

// Fetch eligible tabs from background
async function fetchAndPopulateTabs() {
  refreshBtn.classList.add('spinning');
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_ELIGIBLE_TABS' });
    eligibleTabs = response.tabs || [];

    populateSelect(selectTargetA, selectedTargetA);
    populateSelect(selectTargetB, selectedTargetB, true); // True = include "None"

    // Verify selections still exist
    validateSelections();

    // Update statuses immediately
    updateTargetStatuses();

    addDiagnostic({ type: 'success', message: `Fetched ${eligibleTabs.length} eligible tabs` });
  } catch (err) {
    addDiagnostic({ type: 'error', message: `Fetch tabs failed: ${err.message}` });
  }
  setTimeout(() => refreshBtn.classList.remove('spinning'), 500);
}

// Populate a dropdown
function populateSelect(selectEl, currentSelectionId, includeNone = false) {
  selectEl.innerHTML = '';

  if (includeNone) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'None';
    selectEl.appendChild(opt);
  }

  if (eligibleTabs.length === 0) {
    const opt = document.createElement('option');
    opt.disabled = true;
    opt.textContent = 'No eligible tabs found';
    selectEl.appendChild(opt);
    return;
  }

  eligibleTabs.forEach(tab => {
    const opt = document.createElement('option');
    opt.value = tab.id;
    // Format: [PROV] Title (Win ID)
    const prov = tab.provider.toUpperCase().substring(0, 3);
    const title = tab.title.length > 25 ? tab.title.substring(0, 25) + '...' : tab.title;
    opt.textContent = `[${prov}] ${title} (Win ${tab.windowId})`;
    selectEl.appendChild(opt);
  });

  // Restore selection if exists in list
  if (currentSelectionId && eligibleTabs.find(t => t.id === currentSelectionId)) {
    selectEl.value = currentSelectionId;
  } else if (!includeNone && eligibleTabs.length > 0) {
    // If required (Target A) and execution is null or invalid, pick first
    selectEl.value = eligibleTabs[0].id;
    handleTargetChange(); // Save this auto-selection
  } else {
    selectEl.value = '';
  }
}

// Validate if selected tabs triggered invalidation
function validateSelections() {
  const newA = parseInt(selectTargetA.value) || null;
  const newB = parseInt(selectTargetB.value) || null;

  if (selectedTargetA && !newA && eligibleTabs.length === 0) {
    selectedTargetA = null;
    chrome.storage.local.remove('selectedTargetA');
  } else if (newA) {
    selectedTargetA = newA;
  }

  if (selectedTargetB && !newB) {
    selectedTargetB = null;
    chrome.storage.local.remove('selectedTargetB');
  } else if (newB) {
    selectedTargetB = newB;
  }
}

// Handle Dropdown Change
function handleTargetChange() {
  const valA = selectTargetA.value;
  selectedTargetA = valA ? parseInt(valA) : null;

  const valB = selectTargetB.value;
  selectedTargetB = valB ? parseInt(valB) : null;

  chrome.storage.local.set({
    selectedTargetA: selectedTargetA,
    selectedTargetB: selectedTargetB
  });

  updateTargetStatuses();
}

// Update Status Dots (Ping Targets)
async function updateTargetStatuses() {
  updateDot(statusDotA, selectedTargetA);
  updateDot(statusDotB, selectedTargetB);
}

async function updateDot(dotEl, tabId) {
  if (!tabId) {
    dotEl.className = 'status-dot-wrapper gray';
    return;
  }

  // Find info (url needed for auto-inject fallback)
  const tabInfo = eligibleTabs.find(t => t.id === tabId);
  const tabUrl = tabInfo ? tabInfo.url : null;

  try {
    const res = await chrome.runtime.sendMessage({
      type: 'PING_TAB',
      tabId: tabId,
      tabUrl: tabUrl
    });

    if (res && res.ready) {
      dotEl.className = 'status-dot-wrapper green';
      dotEl.title = 'Ready';
    } else {
      dotEl.className = 'status-dot-wrapper red';
      dotEl.title = res.reason || 'Not connected';
    }
  } catch (e) {
    dotEl.className = 'status-dot-wrapper red';
    dotEl.title = 'Connection failed';
  }
}

// Get Targets List
function getTargets() {
  const targets = [];
  if (selectedTargetA) targets.push(selectedTargetA);
  if (selectedTargetB && selectedTargetB !== selectedTargetA) targets.push(selectedTargetB);
  return targets;
}

// Diagnostics
function addDiagnostic(entry) {
  const timestamp = new Date().toLocaleTimeString();
  diagnostics.unshift({ ...entry, timestamp });
  if (diagnostics.length > MAX_DIAG_ENTRIES) diagnostics.pop();

  if (diagnostics.length === 0) {
    diagLog.innerHTML = 'No diagnostics yet';
    return;
  }
  diagLog.innerHTML = diagnostics.map(d => {
    const cls = d.type === 'error' ? 'diag-error' : d.type === 'success' ? 'diag-success' : '';
    return `<div class="diag-entry ${cls}">[${d.timestamp}] ${d.message}</div>`;
  }).join('');
}

// Sync Text
async function syncText() {
  const text = masterInput.value;
  if (text.length > MAX_TEXT_LENGTH) {
    showToast('Text too long (100kb limit)', 'warning');
    return;
  }

  chrome.storage.local.set({ inputText: text });

  const targets = getTargets();
  if (targets.length === 0) return; // No targets, nothing to do

  for (const tabId of targets) {
    const tabInfo = eligibleTabs.find(t => t.id === tabId);
    if (!tabInfo) continue;

    chrome.runtime.sendMessage({ type: 'SET_TEXT', tabId, text, tabUrl: tabInfo.url })
      .then(res => {
        if (!res.ok) {
          addDiagnostic({ type: 'error', message: `Sync failed (Tab ${tabId}): ${res.error}` });
          updateTargetStatuses(); // Check if dot should go red
        }
      })
      .catch(() => { });
  }
}

// Send All
async function sendAll() {
  await syncText();
  // Short delay
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
    masterInput.value = '';
    updateCharCount();
    chrome.storage.local.set({ inputText: '' });
  } else {
    showToast('Failed to send to targets', 'error');
  }

  updateTargetStatuses();
}

// UI Helpers
function updateCharCount() {
  charCount.textContent = masterInput.value.length;
}

function updateSyncUI() {
  const isLive = liveSyncToggle.checked;
  syncHint.textContent = isLive ? 'Mirrors as you type' : 'Click "Sync Now" to mirror';
  syncNowBtn.style.display = isLive ? 'none' : 'flex';
}

function showToast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  toastContainer.appendChild(el);
  setTimeout(() => {
    el.classList.add('fade-out');
    setTimeout(() => el.remove(), 300);
  }, 2500);
}

// Listeners
masterInput.addEventListener('input', () => {
  updateCharCount();
  if (liveSyncToggle.checked) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(syncText, DEBOUNCE_MS);
  }
});

masterInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendAll();
  }
});

liveSyncToggle.addEventListener('change', () => {
  const isLive = liveSyncToggle.checked;
  chrome.storage.local.set({ liveSync: isLive });
  updateSyncUI();
});

syncNowBtn.addEventListener('click', syncText);
clearBtn.addEventListener('click', () => {
  masterInput.value = '';
  updateCharCount();
  chrome.storage.local.set({ inputText: '' });
  showToast('Cleared', 'success');
});
sendBtn.addEventListener('click', sendAll);
refreshBtn.addEventListener('click', fetchAndPopulateTabs);

themeToggle.addEventListener('click', () => {
  const hasDark = document.body.classList.contains('dark');
  const hasLight = document.body.classList.contains('light');

  if (!hasDark && !hasLight) {
    document.body.classList.add('light'); // System -> Light
    chrome.storage.local.set({ theme: 'light' });
  } else if (hasLight) {
    document.body.classList.remove('light');
    document.body.classList.add('dark'); // Light -> Dark
    chrome.storage.local.set({ theme: 'dark' });
  } else {
    document.body.classList.remove('dark'); // Dark -> System
    chrome.storage.local.remove('theme');
  }
});

diagToggle.addEventListener('click', () => {
  diagContent.classList.toggle('visible');
  diagArrow.classList.toggle('expanded');
});

// Start
init();
