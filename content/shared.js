// TwinType Shared Content Script Utilities

/**
 * Creates a logging function for a specific provider
 * @param {string} provider - The provider name (chatgpt, claude, gemini)
 * @returns {function} Logging function
 */
function createLogger(provider) {
  const prefix = `[TwinType:${provider}]`;
  return function log(message, data = null) {
    if (data) {
      console.log(prefix, message, data);
    } else {
      console.log(prefix, message);
    }
  };
}

/**
 * Checks if an element is visible in the DOM
 * @param {Element|null} el - The element to check
 * @returns {boolean} Whether the element is visible
 */
function isVisible(el) {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
  return rect.width > 0 &&
    rect.height > 0 &&
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0';
}

/**
 * Moves the caret to the end of an element
 * @param {Element} el - The element (textarea or contenteditable)
 */
function moveCaretToEnd(el) {
  try {
    if (el.tagName === 'TEXTAREA') {
      el.selectionStart = el.selectionEnd = el.value.length;
    } else {
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(el);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    el.focus();
  } catch (e) {
    // Best effort - selection APIs may fail in some edge cases
  }
}

/**
 * Finds a send button using the provided selectors
 * @param {string[]} selectors - CSS selectors to try
 * @returns {Element|null} The send button or null
 */
function findSendButton(selectors) {
  for (const selector of selectors) {
    try {
      const el = document.querySelector(selector);
      if (el && isVisible(el) && !el.disabled) {
        return el;
      }
    } catch (e) {
      // Selector may be invalid, continue
    }
  }
  return null;
}

/**
 * Finds a button with send-related aria-label
 * @returns {Element|null} A button element or null
 */
function findButtonByAriaLabel() {
  const buttons = document.querySelectorAll('button');
  for (const btn of buttons) {
    if (!isVisible(btn) || btn.disabled) continue;
    const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
    if (ariaLabel.includes('send') || ariaLabel.includes('submit')) {
      return btn;
    }
  }
  return null;
}

/**
 * Simulates an Enter key press on an element
 * @param {Element} el - The element to dispatch the event on
 * @param {Object} options - Additional options (ctrlKey, shiftKey)
 */
function simulateEnterKey(el, options = {}) {
  el.focus();
  const enterEvent = new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true,
    ctrlKey: options.ctrlKey || false,
    shiftKey: options.shiftKey || false
  });
  el.dispatchEvent(enterEvent);
}

/**
 * Sets text in a textarea using native value setter (bypasses React controlled inputs)
 * @param {HTMLTextAreaElement} textarea - The textarea element
 * @param {string} text - The text to set
 */
function setTextareaValue(textarea, text) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype, 'value'
  ).set;
  nativeInputValueSetter.call(textarea, text);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Creates a content script handler with common patterns
 * @param {Object} config - Configuration object
 * @param {string} config.provider - Provider name
 * @param {function} config.findComposer - Function to find the composer element
 * @param {function} config.setComposerText - Function to set text in composer
 * @param {function} config.sendComposer - Function to send the message
 * @param {function} config.getComposerText - Function to get text from composer
 * @returns {Object} Handler methods
 */
function createContentScript(config) {
  const { provider, findComposer, setComposerText, sendComposer, getComposerText } = config;
  const log = createLogger(provider);

  let composer = null;
  let observer = null;
  let observerDebounceTimer = null;
  let lastComposerFound = false;

  // Reverse sync state
  let suppressReverse = false;
  let suppressTimer = null;
  let inputListener = null;
  let lastSentText = '';
  const SUPPRESS_MS = 500;

  function checkComposerReady() {
    composer = findComposer();
    const found = composer !== null;

    if (found !== lastComposerFound) {
      log(found ? 'Composer found' : 'Composer lost');
      lastComposerFound = found;
      if (found) {
        attachInputListener();
      }
    }

    return found;
  }

  function attachInputListener() {
    if (!composer) return;

    // Remove old listener if exists
    if (inputListener && composer._twinTypeListener) {
      composer.removeEventListener('input', composer._twinTypeListener);
    }

    inputListener = (e) => {
      if (suppressReverse) return;

      const text = getComposerText ? getComposerText() : '';
      if (text === lastSentText) return;
      lastSentText = text;

      chrome.runtime.sendMessage({
        type: 'COMPOSER_CHANGED',
        provider,
        text
      }).catch(() => {});
    };

    composer._twinTypeListener = inputListener;
    composer.addEventListener('input', inputListener);
  }

  function setupObserver() {
    if (observer) {
      observer.disconnect();
    }

    observer = new MutationObserver(() => {
      clearTimeout(observerDebounceTimer);
      observerDebounceTimer = setTimeout(() => {
        checkComposerReady();
        attachInputListener();
      }, 100);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function handleMessage(message, sender, sendResponse) {
    log('Received message:', message.type);

    switch (message.type) {
      case 'PING': {
        const composerReady = checkComposerReady();
        sendResponse({
          ok: true,
          provider,
          composerReady,
          reason: composerReady ? null : 'composer not found'
        });
        break;
      }

      case 'SET_TEXT':
        // Enable suppression to prevent reverse sync loop
        suppressReverse = true;
        clearTimeout(suppressTimer);
        suppressTimer = setTimeout(() => {
          suppressReverse = false;
        }, SUPPRESS_MS);

        sendResponse(setComposerText(message.text));
        break;

      case 'SEND':
        sendResponse(sendComposer());
        break;

      case 'GET_TEXT': {
        const text = getComposerText ? getComposerText() : '';
        sendResponse({ ok: true, text, provider });
        break;
      }

      default:
        sendResponse({ ok: false, error: 'Unknown message type' });
    }
    return true;
  }

  function init() {
    log('Content script loaded');
    setupObserver();
    checkComposerReady();
    attachInputListener();
    chrome.runtime.onMessage.addListener(handleMessage);
  }

  return {
    log,
    checkComposerReady,
    setupObserver,
    handleMessage,
    init,
    getComposer: () => composer,
    setComposer: (c) => { composer = c; }
  };
}

// Export for use in content scripts
window.TwinTypeShared = {
  createLogger,
  isVisible,
  moveCaretToEnd,
  findSendButton,
  findButtonByAriaLabel,
  simulateEnterKey,
  setTextareaValue,
  createContentScript
};
