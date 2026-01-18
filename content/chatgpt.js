// TwinType Content Script for ChatGPT (chatgpt.com)

(function () {
  'use strict';

  const PROVIDER = 'chatgpt';

  // Logging helper
  function log(message, data = null) {
    const prefix = `[TwinType:${PROVIDER}]`;
    if (data) {
      console.log(prefix, message, data);
    } else {
      console.log(prefix, message);
    }
  }

  // Selectors for ChatGPT composer (ordered by reliability)
  const COMPOSER_SELECTORS = [
    '#prompt-textarea',                                    // Main textarea (current)
    'div[contenteditable="true"]#prompt-textarea',         // Contenteditable version
    'textarea[data-id="root"]',                           // Alternative
    'div[contenteditable="true"][data-placeholder*="Message"]', // With placeholder
    'form textarea',                                       // Fallback
    'div[contenteditable="true"][data-placeholder]'       // Generic contenteditable
  ];

  // Selectors for send button
  const SEND_BUTTON_SELECTORS = [
    'button[data-testid="send-button"]',
    'button[aria-label="Send prompt"]',
    'button[aria-label="Send message"]',
    'form button[type="submit"]'
  ];

  let composer = null;
  let observer = null;
  let observerDebounceTimer = null;
  let lastComposerFound = false;

  // Find composer element
  function findComposer() {
    for (const selector of COMPOSER_SELECTORS) {
      try {
        const el = document.querySelector(selector);
        if (el && isVisible(el)) {
          return el;
        }
      } catch (e) {
        // Selector failed, continue
      }
    }

    // Heuristic: find largest visible textarea/contenteditable near bottom
    const candidates = [
      ...document.querySelectorAll('textarea'),
      ...document.querySelectorAll('[contenteditable="true"]')
    ].filter(el => isVisible(el) && isNearBottom(el));

    if (candidates.length > 0) {
      // Sort by size (larger = more likely to be main input)
      candidates.sort((a, b) => {
        const aRect = a.getBoundingClientRect();
        const bRect = b.getBoundingClientRect();
        return (bRect.width * bRect.height) - (aRect.width * aRect.height);
      });
      return candidates[0];
    }

    return null;
  }

  // Check if element is visible
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

  // Check if element is in lower half of viewport
  function isNearBottom(el) {
    const rect = el.getBoundingClientRect();
    return rect.top > window.innerHeight * 0.3;
  }

  // Find send button
  function findSendButton() {
    for (const selector of SEND_BUTTON_SELECTORS) {
      try {
        const el = document.querySelector(selector);
        if (el && isVisible(el) && !el.disabled) {
          return el;
        }
      } catch (e) {
        // Some selectors may fail, continue
      }
    }

    // Fallback: find button near composer that looks like send
    const buttons = document.querySelectorAll('form button');
    for (const btn of buttons) {
      if (isVisible(btn) && !btn.disabled) {
        // Check if it has an arrow/send icon
        const svg = btn.querySelector('svg');
        if (svg) return btn;
      }
    }

    return null;
  }

  // Set text in composer
  function setComposerText(text) {
    composer = findComposer();
    if (!composer) {
      log('Composer not found for SET_TEXT');
      return { ok: false, error: 'Composer not found' };
    }

    try {
      if (composer.tagName === 'TEXTAREA') {
        // Use native value setter to bypass React's controlled input
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype, 'value'
        ).set;
        nativeInputValueSetter.call(composer, text);

        // Dispatch events
        composer.dispatchEvent(new Event('input', { bubbles: true }));
        composer.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        // Contenteditable
        composer.focus();

        // For ProseMirror/contenteditable, we need to set the content properly
        const p = composer.querySelector('p');
        if (p) {
          p.textContent = text;
        } else {
          composer.textContent = text;
        }

        // Dispatch input event
        composer.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: text
        }));
      }

      // Move caret to end
      moveCaretToEnd(composer);
      log('Text set successfully');

      return { ok: true };
    } catch (err) {
      log('Error setting text:', err.message);
      return { ok: false, error: err.message };
    }
  }

  // Move caret to end of element
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
      // Best effort
    }
  }

  // Send the message
  function sendComposer() {
    composer = findComposer();
    if (!composer) {
      log('Composer not found for SEND');
      return { ok: false, error: 'Composer not found' };
    }

    try {
      // Try clicking send button first
      const sendBtn = findSendButton();
      if (sendBtn) {
        log('Clicking send button');
        sendBtn.click();
        return { ok: true };
      }

      // Fallback: simulate Enter key
      log('No send button found, simulating Enter key');
      composer.focus();
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      });
      composer.dispatchEvent(enterEvent);

      return { ok: true };
    } catch (err) {
      log('Error sending:', err.message);
      return { ok: false, error: err.message };
    }
  }

  // Check if composer is ready
  function checkComposerReady() {
    composer = findComposer();
    const found = composer !== null;

    if (found !== lastComposerFound) {
      log(found ? 'Composer found' : 'Composer lost');
      lastComposerFound = found;
    }

    return found;
  }

  // Setup mutation observer to track DOM changes (debounced for performance)
  function setupObserver() {
    if (observer) {
      observer.disconnect();
    }

    observer = new MutationObserver(() => {
      // Debounce to avoid excessive findComposer calls
      clearTimeout(observerDebounceTimer);
      observerDebounceTimer = setTimeout(() => {
        checkComposerReady();
      }, 100);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Message handler
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    log('Received message:', message.type);

    switch (message.type) {
      case 'PING':
        const composerReady = checkComposerReady();
        const response = {
          ok: true,
          provider: PROVIDER,
          composerReady,
          reason: composerReady ? null : 'composer not found'
        };
        sendResponse(response);
        break;

      case 'SET_TEXT':
        sendResponse(setComposerText(message.text));
        break;

      case 'SEND':
        sendResponse(sendComposer());
        break;

      default:
        sendResponse({ ok: false, error: 'Unknown message type' });
    }
    return true;
  });

  // Initialize
  log('Content script loaded');
  console.log('[TwinType] Content script loaded (ChatGPT)');
  setupObserver();
  checkComposerReady();
})();
