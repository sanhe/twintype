// TwinType Content Script for Claude (claude.ai)

(function () {
  'use strict';

  const { isVisible, moveCaretToEnd, findSendButton, findButtonByAriaLabel, simulateEnterKey, createContentScript } = window.TwinTypeShared;

  const COMPOSER_SELECTORS = [
    'div[contenteditable="true"].ProseMirror',
    'div.ProseMirror[contenteditable="true"]',
    '[data-placeholder][contenteditable="true"]',
    'div[contenteditable="true"][aria-label*="Message" i]',
    'div[contenteditable="true"][role="textbox"]',
    'fieldset div[contenteditable="true"]',
    'div[contenteditable="true"]'
  ];

  const SEND_BUTTON_SELECTORS = [
    'button[aria-label*="Send" i]',
    'button[aria-label*="Submit" i]',
    'fieldset button[type="button"]',
    'button.send-message-button'
  ];

  function looksLikeComposer(el) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 100) return false;

    const isNearBottom = rect.top > window.innerHeight * 0.4;
    const isProseMirror = el.classList.contains('ProseMirror');
    const hasPlaceholder = el.hasAttribute('data-placeholder') || el.getAttribute('aria-placeholder');

    return isNearBottom || isProseMirror || hasPlaceholder;
  }

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
        // Selector may fail, continue
      }
    }

    // Heuristic fallback
    const candidates = document.querySelectorAll('[contenteditable="true"]');
    for (const el of candidates) {
      if (isVisible(el) && looksLikeComposer(el)) {
        return el;
      }
    }

    return null;
  }

  function findSendButtonWithFallback() {
    const btn = findSendButton(SEND_BUTTON_SELECTORS);
    if (btn) return btn;

    const byAriaLabel = findButtonByAriaLabel();
    if (byAriaLabel) return byAriaLabel;

    // Check for arrow-up icon (common send icon)
    const buttons = document.querySelectorAll('button');
    for (const button of buttons) {
      if (!isVisible(button) || button.disabled) continue;
      const hasSvg = button.querySelector('svg');
      if (hasSvg) {
        const svgContent = button.innerHTML.toLowerCase();
        if (svgContent.includes('arrow') || svgContent.includes('19v5')) {
          return button;
        }
      }
    }

    return null;
  }

  function moveCaretToEndProseMirror(el) {
    try {
      el.focus();
      const range = document.createRange();
      const sel = window.getSelection();

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

  function setComposerText(text) {
    const composer = findComposer();
    if (!composer) {
      return { ok: false, error: 'Composer not found' };
    }

    try {
      composer.focus();

      // For ProseMirror, handle paragraphs properly
      const paragraphs = composer.querySelectorAll('p');
      if (paragraphs.length > 0) {
        paragraphs[0].textContent = text;
        for (let i = 1; i < paragraphs.length; i++) {
          paragraphs[i].remove();
        }
      } else {
        composer.innerHTML = '';
        const p = document.createElement('p');
        p.textContent = text;
        composer.appendChild(p);
      }

      // Dispatch events for ProseMirror
      composer.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text
      }));

      composer.dispatchEvent(new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text
      }));

      moveCaretToEndProseMirror(composer);
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

  const script = createContentScript({
    provider: 'claude',
    findComposer,
    setComposerText,
    sendComposer
  });

  script.init();
})();
