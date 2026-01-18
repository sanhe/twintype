// TwinType Content Script for Google Gemini (gemini.google.com)

(function () {
  'use strict';

  const PROVIDER = 'gemini';

  // Logging helper
  function log(message, data = null) {
    const prefix = `[TwinType:${PROVIDER}]`;
    if (data) {
      console.log(prefix, message, data);
    } else {
      console.log(prefix, message);
    }
  }

  // Selectors for Gemini composer (ordered by reliability)
  const COMPOSER_SELECTORS = [
    '.ql-editor[contenteditable="true"]',           // Quill editor
    'div[contenteditable="true"].ql-editor',        // Quill variant
    'rich-textarea [contenteditable="true"]',       // Rich textarea component
    'div.input-area [contenteditable="true"]',      // Input area
    'div[aria-label*="prompt" i][contenteditable="true"]',
    'div[contenteditable="true"][data-placeholder]', // Generic with placeholder
    'textarea[aria-label*="prompt" i]',             // Textarea fallback
    '.text-input-field textarea',                    // Alternative
    'div[contenteditable="true"][role="textbox"]'   // Role textbox
  ];

  // Selectors for send button
  const SEND_BUTTON_SELECTORS = [
    'button[aria-label*="Send" i]',
    'button[aria-label*="Submit" i]',
    'button.send-button',
    'button[mattooltip*="Send" i]',
    '.input-area button[aria-label]'
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
        // Some selectors may fail
      }
    }

    // Heuristic: find contenteditable elements that look like input
    const candidates = [
      ...document.querySelectorAll('[contenteditable="true"]'),
      ...document.querySelectorAll('textarea')
    ].filter(el => {
      if (!isVisible(el)) return false;
      const rect = el.getBoundingClientRect();
      // Should be reasonably sized
      return rect.width > 100 && rect.height > 20;
    });

    // Prefer elements near the bottom
    const bottomCandidates = candidates.filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.top > window.innerHeight * 0.4;
    });

    if (bottomCandidates.length > 0) {
      return bottomCandidates[0];
    }

    return candidates.length > 0 ? candidates[0] : null;
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

  // Find send button
  function findSendButton() {
    for (const selector of SEND_BUTTON_SELECTORS) {
      try {
        const el = document.querySelector(selector);
        if (el && isVisible(el) && !el.disabled) {
          return el;
        }
      } catch (e) {
        // Continue on selector failure
      }
    }

    // Look for button with send icon near the input
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

  // Set text in composer
  function setComposerText(text) {
    composer = findComposer();
    if (!composer) {
      log('Composer not found for SET_TEXT');
      return { ok: false, error: 'Composer not found' };
    }

    try {
      if (composer.tagName === 'TEXTAREA') {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype, 'value'
        ).set;
        nativeInputValueSetter.call(composer, text);
        composer.dispatchEvent(new Event('input', { bubbles: true }));
        composer.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        // Contenteditable (Quill or similar)
        composer.focus();

        // Clear existing content
        composer.innerHTML = '';

        // For Quill editor, create a paragraph
        const p = document.createElement('p');
        p.textContent = text;
        composer.appendChild(p);

        // Dispatch events
        composer.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: text
        }));

        // Also try text-changed event for Quill
        composer.dispatchEvent(new Event('text-change', { bubbles: true }));
      }

      moveCaretToEnd(composer);
      log('Text set successfully');
      return { ok: true };
    } catch (err) {
      log('Error setting text:', err.message);
      return { ok: false, error: err.message };
    }
  }

  // Move caret to end
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
      // Try clicking send button
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

  // Setup mutation observer (debounced for performance)
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
  console.log('[TwinType] Content script loaded (Gemini)');
  setupObserver();
  checkComposerReady();
})();
