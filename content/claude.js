// TwinType Content Script for Claude (claude.ai)

(function () {
  'use strict';

  const PROVIDER = 'claude';

  // Logging helper
  function log(message, data = null) {
    const prefix = `[TwinType:${PROVIDER}]`;
    if (data) {
      console.log(prefix, message, data);
    } else {
      console.log(prefix, message);
    }
  }

  // Selectors for Claude composer (ordered by reliability)
  const COMPOSER_SELECTORS = [
    'div[contenteditable="true"].ProseMirror',      // ProseMirror editor
    'div.ProseMirror[contenteditable="true"]',      // Alternative
    '[data-placeholder][contenteditable="true"]',   // With placeholder
    'div[contenteditable="true"][aria-label*="Message" i]',
    'div[contenteditable="true"][role="textbox"]',
    'fieldset div[contenteditable="true"]',         // Inside fieldset
    'div[contenteditable="true"]'                    // Generic fallback
  ];

  // Selectors for send button
  const SEND_BUTTON_SELECTORS = [
    'button[aria-label*="Send" i]',
    'button[aria-label*="Submit" i]',
    'fieldset button[type="button"]',
    'button.send-message-button'
  ];

  let composer = null;
  let observer = null;
  let observerDebounceTimer = null;
  let lastComposerFound = false;

  // Find composer element
  function findComposer() {
    for (const selector of COMPOSER_SELECTORS) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          if (isVisible(el) && looksLikeComposer(el)) {
            return el;
          }
        }
      } catch (e) {
        // Some selectors may fail
      }
    }

    // Heuristic search
    const candidates = document.querySelectorAll('[contenteditable="true"]');
    for (const el of candidates) {
      if (isVisible(el) && looksLikeComposer(el)) {
        return el;
      }
    }

    return null;
  }

  // Check if element looks like a message composer
  function looksLikeComposer(el) {
    const rect = el.getBoundingClientRect();
    // Should be reasonably wide and not too tall (not a code editor)
    if (rect.width < 100) return false;

    // Check if it's near the bottom of the page
    const isNearBottom = rect.top > window.innerHeight * 0.4;

    // Check for ProseMirror class
    const isProseMirror = el.classList.contains('ProseMirror');

    // Check for placeholder
    const hasPlaceholder = el.hasAttribute('data-placeholder') ||
      el.getAttribute('aria-placeholder');

    return (isNearBottom || isProseMirror || hasPlaceholder);
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

    // Look for button with send-related attributes near the composer
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      if (!isVisible(btn) || btn.disabled) continue;
      const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
      if (ariaLabel.includes('send') || ariaLabel.includes('submit')) {
        return btn;
      }
      // Check for arrow-up icon (common send icon)
      const hasSvg = btn.querySelector('svg');
      if (hasSvg) {
        const svgContent = btn.innerHTML.toLowerCase();
        if (svgContent.includes('arrow') || svgContent.includes('19v5')) {
          return btn;
        }
      }
    }

    return null;
  }

  // Set text in composer (ProseMirror-specific)
  function setComposerText(text) {
    composer = findComposer();
    if (!composer) {
      log('Composer not found for SET_TEXT');
      return { ok: false, error: 'Composer not found' };
    }

    try {
      composer.focus();

      // For ProseMirror, we need to handle it carefully
      // First, clear existing content
      const paragraphs = composer.querySelectorAll('p');
      if (paragraphs.length > 0) {
        // Update first paragraph, remove others
        paragraphs[0].textContent = text;
        for (let i = 1; i < paragraphs.length; i++) {
          paragraphs[i].remove();
        }
      } else {
        // Create a new paragraph
        composer.innerHTML = '';
        const p = document.createElement('p');
        p.textContent = text;
        composer.appendChild(p);
      }

      // Dispatch input event for ProseMirror to pick up
      composer.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text
      }));

      // Also dispatch a beforeinput event
      composer.dispatchEvent(new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text
      }));

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
      el.focus();
      const range = document.createRange();
      const sel = window.getSelection();

      // Find the last text node
      let lastNode = el;
      while (lastNode.lastChild) {
        lastNode = lastNode.lastChild;
      }

      if (lastNode.nodeType === Node.TEXT_NODE) {
        range.setStart(lastNode, lastNode.textContent.length);
        range.setEnd(lastNode, lastNode.textContent.length);
      } else {
        range.selectNodeContents(el);
        range.collapse(false);
      }

      sel.removeAllRanges();
      sel.addRange(range);
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

      // Fallback: simulate Enter key (may not work on Claude due to Shift+Enter behavior)
      log('No send button found, simulating Enter key');
      composer.focus();

      // For Claude, we might need Ctrl+Enter or just Enter depending on settings
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
        ctrlKey: false,
        shiftKey: false
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
  console.log('[TwinType] Content script loaded (Claude)');
  setupObserver();
  checkComposerReady();
})();
