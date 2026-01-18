// TwinType Content Script for ChatGPT (chatgpt.com)

(function () {
  'use strict';

  const { isVisible, moveCaretToEnd, findSendButton, simulateEnterKey, setTextareaValue, createContentScript } = window.TwinTypeShared;

  const COMPOSER_SELECTORS = [
    '#prompt-textarea',
    'div[contenteditable="true"]#prompt-textarea',
    'textarea[data-id="root"]',
    'div[contenteditable="true"][data-placeholder*="Message"]',
    'form textarea',
    'div[contenteditable="true"][data-placeholder]'
  ];

  const SEND_BUTTON_SELECTORS = [
    'button[data-testid="send-button"]',
    'button[aria-label="Send prompt"]',
    'button[aria-label="Send message"]',
    'form button[type="submit"]'
  ];

  function isNearBottom(el) {
    const rect = el.getBoundingClientRect();
    return rect.top > window.innerHeight * 0.3;
  }

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

    if (candidates.length === 0) {
      return null;
    }

    // Sort by size (larger = more likely to be main input)
    candidates.sort((a, b) => {
      const aRect = a.getBoundingClientRect();
      const bRect = b.getBoundingClientRect();
      return (bRect.width * bRect.height) - (aRect.width * aRect.height);
    });

    return candidates[0];
  }

  function findSendButtonWithFallback() {
    const btn = findSendButton(SEND_BUTTON_SELECTORS);
    if (btn) return btn;

    // Fallback: find button near composer that has an SVG icon
    const buttons = document.querySelectorAll('form button');
    for (const button of buttons) {
      if (isVisible(button) && !button.disabled && button.querySelector('svg')) {
        return button;
      }
    }

    return null;
  }

  function setComposerText(text) {
    const composer = findComposer();
    if (!composer) {
      return { ok: false, error: 'Composer not found' };
    }

    try {
      if (composer.tagName === 'TEXTAREA') {
        setTextareaValue(composer, text);
      } else {
        composer.focus();
        const p = composer.querySelector('p');
        if (p) {
          p.textContent = text;
        } else {
          composer.textContent = text;
        }
        composer.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: text
        }));
      }

      moveCaretToEnd(composer);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  function sendComposer() {
    const composer = findComposer();
    if (!composer) {
      return { ok: false, error: 'Composer not found' };
    }

    try {
      const sendBtn = findSendButtonWithFallback();
      if (sendBtn) {
        sendBtn.click();
        return { ok: true };
      }

      simulateEnterKey(composer);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  function getComposerText() {
    const composer = findComposer();
    if (!composer) return '';

    if (composer.tagName === 'TEXTAREA') {
      return composer.value || '';
    } else {
      return composer.textContent || '';
    }
  }

  const script = createContentScript({
    provider: 'chatgpt',
    findComposer,
    setComposerText,
    sendComposer,
    getComposerText
  });

  script.init();
})();
