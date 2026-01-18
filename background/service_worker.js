// TwinType Background Service Worker
// Manages tab discovery and messaging

const PROVIDER_PATTERNS = {
  chatgpt: /^https:\/\/chatgpt\.com\/.*/,
  gemini: /^https:\/\/gemini\.google\.com\/.*/,
  claude: /^https:\/\/claude\.ai\/.*/
};

function log(message, data = null) {
  const timestamp = new Date().toISOString().substr(11, 12);
  if (data) {
    console.log(`[TwinType ${timestamp}] ${message}`, data);
  } else {
    console.log(`[TwinType ${timestamp}] ${message}`);
  }
}

// Initialize side panel behavior
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// Handle keyboard shortcut
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== '_execute_action') return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.windowId) {
    chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
  }
});

function getProvider(url) {
  if (!url) return null;
  for (const [provider, pattern] of Object.entries(PROVIDER_PATTERNS)) {
    if (pattern.test(url)) return provider;
  }
  return null;
}

async function getEligibleTabs() {
  try {
    const windows = await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] });
    const eligibleTabs = [];

    for (const win of windows) {
      for (const tab of win.tabs) {
        const provider = getProvider(tab.url);
        if (provider) {
          eligibleTabs.push({
            id: tab.id,
            windowId: win.id,
            provider,
            title: tab.title || 'Untitled',
            url: tab.url,
            active: tab.active
          });
        }
      }
    }
    return eligibleTabs;
  } catch (err) {
    log('Error getting eligible tabs:', err.message);
    return [];
  }
}

async function injectContentScript(tabId, url) {
  const provider = getProvider(url);
  if (!provider) return false;

  try {
    log(`Injecting content script for tab ${tabId}`);
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [`content/shared.js`, `content/${provider}.js`]
    });
    await new Promise(r => setTimeout(r, 50));
    return true;
  } catch (e) {
    log(`Injection failed: ${e.message}`);
    return false;
  }
}

async function pingTab(tabId, tabUrl, retry = true) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'PING' });

    if (response?.ok === true) {
      return {
        ready: response.composerReady === true,
        reason: response.composerReady ? null : (response.reason || 'composer not found')
      };
    }
    return { ready: false, reason: response?.reason || 'content script error' };
  } catch (err) {
    log(`Ping failed for tab ${tabId}:`, err.message);

    // Auto-injection fallback
    if (retry && err.message.includes('Could not establish connection')) {
      const injected = await injectContentScript(tabId, tabUrl);
      if (injected) {
        return pingTab(tabId, tabUrl, false);
      }
      return { ready: false, reason: 'injection failed' };
    }

    if (err.message.includes('Extension context invalidated')) {
      return { ready: false, reason: 'extension reloaded' };
    }
    if (err.message.includes('Cannot access')) {
      return { ready: false, reason: 'permission denied' };
    }
    return { ready: false, reason: 'no receiver' };
  }
}

async function setTextInTab(tabId, tabUrl, text) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'SET_TEXT', text });
    return { ok: response?.ok, error: response?.error };
  } catch (err) {
    // Auto-inject on connection error
    if (err.message.includes('Could not establish connection')) {
      const injected = await injectContentScript(tabId, tabUrl);
      if (injected) {
        try {
          const response = await chrome.tabs.sendMessage(tabId, { type: 'SET_TEXT', text });
          return { ok: response?.ok, error: response?.error };
        } catch (e) {
          return { ok: false, error: e.message };
        }
      }
      return { ok: false, error: 'no receiver (injection failed)' };
    }
    return { ok: false, error: err.message };
  }
}

async function sendCommandToTab(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'SEND' });
    return { ok: response?.ok, error: response?.error };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_ELIGIBLE_TABS':
      getEligibleTabs().then(tabs => sendResponse({ tabs }));
      return true;

    case 'PING_TAB':
      pingTab(message.tabId, message.tabUrl).then(sendResponse);
      return true;

    case 'SET_TEXT':
      setTextInTab(message.tabId, message.tabUrl, message.text).then(sendResponse);
      return true;

    case 'SEND_COMMAND':
      sendCommandToTab(message.tabId).then(sendResponse);
      return true;

    default:
      return false;
  }
});
