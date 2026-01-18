// TwinType Content Script for Google Gemini (gemini.google.com)

(function () {
  'use strict';

  const { isVisible, moveCaretToEnd, findSendButton, findButtonByAriaLabel, simulateEnterKey, setTextareaValue, createContentScript } = window.TwinTypeShared;

  const COMPOSER_SELECTORS = [
    '.ql-editor[contenteditable="true"]',
    'div[contenteditable="true"].ql-editor',
    'rich-textarea [contenteditable="true"]',
    'div.input-area [contenteditable="true"]',
    'div[aria-label*="prompt" i][contenteditable="true"]',
    'div[contenteditable="true"][data-placeholder]',
    'textarea[aria-label*="prompt" i]',
    '.text-input-field textarea',
    'div[contenteditable="true"][role="textbox"]'
  ];

  const SEND_BUTTON_SELECTORS = [
    'button[aria-label*="Send" i]',
    'button[aria-label*="Submit" i]',
    'button.send-button',
    'button[mattooltip*="Send" i]',
    '.input-area button[aria-label]'
  ];

  function findComposer() {
    for (const selector of COMPOSER_SELECTORS) {
      try {
        const el = document.querySelector(selector);
        if (el && isVisible(el)) {
          return el;
        }
      } catch (e) {
        // Selector may fail, continue
      }
    }

    // Heuristic fallback
    const candidates = [
      ...document.querySelectorAll('[contenteditable="true"]'),
      ...document.querySelectorAll('textarea')
    ].filter(el => {
      if (!isVisible(el)) return false;
      const rect = el.getBoundingClientRect();
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

  function findSendButtonWithFallback() {
    const btn = findSendButton(SEND_BUTTON_SELECTORS);
    if (btn) return btn;
    return findButtonByAriaLabel();
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
        composer.innerHTML = '';

        const p = document.createElement('p');
        p.textContent = text;
        composer.appendChild(p);

        composer.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: text
        }));

        // Quill editor text-change event
        composer.dispatchEvent(new Event('text-change', { bubbles: true }));
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
    provider: 'gemini',
    findComposer,
    setComposerText,
    sendComposer,
    getComposerText
  });

  script.init();
})();
