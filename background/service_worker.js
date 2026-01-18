// TwinType Background Service Worker
// Manages tab discovery and explicit messaging

const PROVIDER_PATTERNS = {
  chatgpt: /^https:\/\/chatgpt\.com\/.*/,
  gemini: /^https:\/\/gemini\.google\.com\/.*/,
  claude: /^https:\/\/claude\.ai\/.*/
};

// Logging helper
function log(message, data = null) {
  const timestamp = new Date().toISOString().substr(11, 12);
  if (data) {
    console.log(`[TwinType ${timestamp}] ${message}`, data);
  } else {
    console.log(`[TwinType ${timestamp}] ${message}`);
  }
}

// Initialize side panel behavior
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => { });

// Handle keyboard shortcut
chrome.commands.onCommand.addListener(async (command) => {
  if (command === '_execute_action') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.windowId) {
      chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => { });
    }
  }
});

// Detect provider from URL
function getProvider(url) {
  if (!url) return null;
  for (const [provider, pattern] of Object.entries(PROVIDER_PATTERNS)) {
    if (pattern.test(url)) return provider;
  }
  return null;
}

// Get ALL eligible tabs across all windows
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
            active: tab.active // useful for UI hints
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

// Ping a specific tab
async function pingTab(tabId, tabUrl, retry = true) {
  try {
    // Basic PING
    const response = await chrome.tabs.sendMessage(tabId, { type: 'PING' });

    if (response?.ok === true) {
      return {
        ready: response.composerReady === true,
        reason: response.composerReady ? null : (response.reason || 'composer not found')
      };
    } else {
      return { ready: false, reason: response?.reason || 'content script error' };
    }
  } catch (err) {
    log(`Ping failed for tab ${tabId}:`, err.message);

    // Auto-injection fallback
    if (retry && err.message.includes('Could not establish connection')) {
      return await injectAndRetryPing(tabId, tabUrl);
    }

    let reason = 'no receiver';
    if (err.message.includes('Extension context invalidated')) {
      reason = 'extension reloaded';
    } else if (err.message.includes('Cannot access')) {
      reason = 'permission denied';
    }
    return { ready: false, reason };
  }
}

// Auto-injection helper
async function injectAndRetryPing(tabId, url) {
  log(`Attempting auto-injection for tab ${tabId}`);
  const provider = getProvider(url);
  if (!provider) return { ready: false, reason: 'unknown provider' };

  try {
    const file = `content/${provider}.js`;
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [file]
    });

    // Tiny delay to let script initialize
    await new Promise(r => setTimeout(r, 50));
    return await pingTab(tabId, url, false);
  } catch (e) {
    log(`Injection failed: ${e.message}`);
    return { ready: false, reason: 'injection failed' };
  }
}

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 1. Get List of Eligible Tabs
  if (message.type === 'GET_ELIGIBLE_TABS') {
    getEligibleTabs().then(tabs => sendResponse({ tabs }));
    return true;
  }

  // 2. Ping specific tab
  if (message.type === 'PING_TAB') {
    pingTab(message.tabId, message.tabUrl).then(result => sendResponse(result));
    return true;
  }

  // 3. Set Text in specific tab
  if (message.type === 'SET_TEXT') {
    chrome.tabs.sendMessage(message.tabId, { type: 'SET_TEXT', text: message.text })
      .then(response => sendResponse({ ok: response?.ok, error: response?.error }))
      .catch(err => {
        // If "no receiver", try inject and retry once
        if (err.message.includes('Could not establish connection')) {
          injectAndRetryPing(message.tabId, message.tabUrl).then(pingRes => {
            if (pingRes.ready) {
              // Retry the SET_TEXT
              chrome.tabs.sendMessage(message.tabId, { type: 'SET_TEXT', text: message.text })
                .then(r => sendResponse({ ok: r?.ok, error: r?.error }))
                .catch(e => sendResponse({ ok: false, error: e.message }));
            } else {
              sendResponse({ ok: false, error: 'no receiver (injection failed)' });
            }
          });
        } else {
          sendResponse({ ok: false, error: err.message });
        }
      });
    return true;
  }

  // 4. Send command to specific tab
  if (message.type === 'SEND_COMMAND') {
    chrome.tabs.sendMessage(message.tabId, { type: 'SEND' })
      .then(response => sendResponse({ ok: response?.ok, error: response?.error }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});

