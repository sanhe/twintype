// Tests for content/shared.js

describe('TwinTypeShared Utilities', () => {
  let TwinTypeShared;

  beforeEach(() => {
    // Mock DOM
    document.body.innerHTML = `
      <div id="test-container"></div>
    `;

    // Load the shared module
    const fs = require('fs');
    const path = require('path');
    const sharedCode = fs.readFileSync(
      path.join(__dirname, '../content/shared.js'),
      'utf8'
    );
    eval(sharedCode);
    TwinTypeShared = window.TwinTypeShared;
  });

  describe('createLogger', () => {
    it('should create a logger with provider prefix', () => {
      const log = TwinTypeShared.createLogger('chatgpt');
      log('test message');
      expect(console.log).toHaveBeenCalledWith('[TwinType:chatgpt]', 'test message');
    });

    it('should log with data when provided', () => {
      const log = TwinTypeShared.createLogger('claude');
      log('test', { foo: 'bar' });
      expect(console.log).toHaveBeenCalledWith('[TwinType:claude]', 'test', { foo: 'bar' });
    });
  });

  describe('isVisible', () => {
    it('should return false for null element', () => {
      expect(TwinTypeShared.isVisible(null)).toBe(false);
    });

    it('should return true for visible element', () => {
      const el = document.createElement('div');
      el.style.width = '100px';
      el.style.height = '100px';
      document.body.appendChild(el);

      // Mock getBoundingClientRect
      el.getBoundingClientRect = jest.fn().mockReturnValue({
        width: 100,
        height: 100
      });

      expect(TwinTypeShared.isVisible(el)).toBe(true);
    });

    it('should return false for hidden element', () => {
      const el = document.createElement('div');
      el.style.display = 'none';
      document.body.appendChild(el);

      el.getBoundingClientRect = jest.fn().mockReturnValue({
        width: 0,
        height: 0
      });

      expect(TwinTypeShared.isVisible(el)).toBe(false);
    });
  });

  describe('moveCaretToEnd', () => {
    it('should move caret to end of textarea', () => {
      const textarea = document.createElement('textarea');
      textarea.value = 'Hello World';
      document.body.appendChild(textarea);

      TwinTypeShared.moveCaretToEnd(textarea);

      expect(textarea.selectionStart).toBe(11);
      expect(textarea.selectionEnd).toBe(11);
    });

    it('should handle contenteditable elements', () => {
      const div = document.createElement('div');
      div.contentEditable = true;
      div.textContent = 'Test';
      document.body.appendChild(div);

      // Mock selection APIs
      window.getSelection = jest.fn().mockReturnValue({
        removeAllRanges: jest.fn(),
        addRange: jest.fn()
      });

      expect(() => TwinTypeShared.moveCaretToEnd(div)).not.toThrow();
    });
  });

  describe('findSendButton', () => {
    it('should find visible enabled button', () => {
      const button = document.createElement('button');
      button.id = 'send-btn';
      button.disabled = false;
      document.body.appendChild(button);

      // Mock visibility check
      button.getBoundingClientRect = jest.fn().mockReturnValue({
        width: 50,
        height: 30
      });

      const found = TwinTypeShared.findSendButton(['#send-btn']);
      expect(found).toBe(button);
    });

    it('should skip disabled buttons', () => {
      const button = document.createElement('button');
      button.id = 'send-btn';
      button.disabled = true;
      document.body.appendChild(button);

      const found = TwinTypeShared.findSendButton(['#send-btn']);
      expect(found).toBeNull();
    });

    it('should try multiple selectors', () => {
      const button = document.createElement('button');
      button.id = 'submit-btn';
      document.body.appendChild(button);

      button.getBoundingClientRect = jest.fn().mockReturnValue({
        width: 50,
        height: 30
      });

      const found = TwinTypeShared.findSendButton(['#send-btn', '#submit-btn']);
      expect(found).toBe(button);
    });
  });

  describe('findButtonByAriaLabel', () => {
    it('should find button with send aria-label', () => {
      const button = document.createElement('button');
      button.setAttribute('aria-label', 'Send message');
      document.body.appendChild(button);

      button.getBoundingClientRect = jest.fn().mockReturnValue({
        width: 50,
        height: 30
      });

      const found = TwinTypeShared.findButtonByAriaLabel();
      expect(found).toBe(button);
    });

    it('should find button with submit aria-label', () => {
      const button = document.createElement('button');
      button.setAttribute('aria-label', 'Submit query');
      document.body.appendChild(button);

      button.getBoundingClientRect = jest.fn().mockReturnValue({
        width: 50,
        height: 30
      });

      const found = TwinTypeShared.findButtonByAriaLabel();
      expect(found).toBe(button);
    });

    it('should skip disabled buttons', () => {
      const button = document.createElement('button');
      button.setAttribute('aria-label', 'Send message');
      button.disabled = true;
      document.body.appendChild(button);

      const found = TwinTypeShared.findButtonByAriaLabel();
      expect(found).toBeNull();
    });
  });

  describe('simulateEnterKey', () => {
    it('should dispatch enter key event', () => {
      const el = document.createElement('div');
      el.focus = jest.fn();
      el.dispatchEvent = jest.fn();

      TwinTypeShared.simulateEnterKey(el);

      expect(el.focus).toHaveBeenCalled();
      expect(el.dispatchEvent).toHaveBeenCalled();

      const event = el.dispatchEvent.mock.calls[0][0];
      expect(event.key).toBe('Enter');
      expect(event.keyCode).toBe(13);
    });

    it('should support ctrl and shift modifiers', () => {
      const el = document.createElement('div');
      el.focus = jest.fn();
      el.dispatchEvent = jest.fn();

      TwinTypeShared.simulateEnterKey(el, { ctrlKey: true, shiftKey: true });

      const event = el.dispatchEvent.mock.calls[0][0];
      expect(event.ctrlKey).toBe(true);
      expect(event.shiftKey).toBe(true);
    });
  });

  describe('setTextareaValue', () => {
    it('should set textarea value and dispatch events', () => {
      const textarea = document.createElement('textarea');
      textarea.dispatchEvent = jest.fn();

      TwinTypeShared.setTextareaValue(textarea, 'Hello World');

      expect(textarea.value).toBe('Hello World');
      expect(textarea.dispatchEvent).toHaveBeenCalledTimes(2);
    });
  });

  describe('createContentScript', () => {
    it('should create content script handler', () => {
      const findComposer = jest.fn().mockReturnValue(document.createElement('textarea'));
      const setComposerText = jest.fn().mockReturnValue({ ok: true });
      const sendComposer = jest.fn().mockReturnValue({ ok: true });
      const getComposerText = jest.fn().mockReturnValue('test text');

      const handler = TwinTypeShared.createContentScript({
        provider: 'test',
        findComposer,
        setComposerText,
        sendComposer,
        getComposerText
      });

      expect(handler).toHaveProperty('init');
      expect(handler).toHaveProperty('handleMessage');
      expect(handler).toHaveProperty('checkComposerReady');
    });

    it('should handle PING message', () => {
      const composer = document.createElement('textarea');
      const findComposer = jest.fn().mockReturnValue(composer);
      const setComposerText = jest.fn();
      const sendComposer = jest.fn();
      const getComposerText = jest.fn();

      const handler = TwinTypeShared.createContentScript({
        provider: 'test',
        findComposer,
        setComposerText,
        sendComposer,
        getComposerText
      });

      const sendResponse = jest.fn();
      handler.handleMessage({ type: 'PING' }, null, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({
        ok: true,
        provider: 'test',
        composerReady: true,
        reason: null
      });
    });

    it('should handle SET_TEXT message', () => {
      const composer = document.createElement('textarea');
      const findComposer = jest.fn().mockReturnValue(composer);
      const setComposerText = jest.fn().mockReturnValue({ ok: true });
      const sendComposer = jest.fn();
      const getComposerText = jest.fn();

      const handler = TwinTypeShared.createContentScript({
        provider: 'test',
        findComposer,
        setComposerText,
        sendComposer,
        getComposerText
      });

      const sendResponse = jest.fn();
      handler.handleMessage({ type: 'SET_TEXT', text: 'Hello' }, null, sendResponse);

      expect(setComposerText).toHaveBeenCalledWith('Hello');
      expect(sendResponse).toHaveBeenCalledWith({ ok: true });
    });

    it('should handle SEND message', () => {
      const composer = document.createElement('textarea');
      const findComposer = jest.fn().mockReturnValue(composer);
      const setComposerText = jest.fn();
      const sendComposer = jest.fn().mockReturnValue({ ok: true });
      const getComposerText = jest.fn();

      const handler = TwinTypeShared.createContentScript({
        provider: 'test',
        findComposer,
        setComposerText,
        sendComposer,
        getComposerText
      });

      const sendResponse = jest.fn();
      handler.handleMessage({ type: 'SEND' }, null, sendResponse);

      expect(sendComposer).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({ ok: true });
    });

    it('should handle GET_TEXT message', () => {
      const composer = document.createElement('textarea');
      const findComposer = jest.fn().mockReturnValue(composer);
      const setComposerText = jest.fn();
      const sendComposer = jest.fn();
      const getComposerText = jest.fn().mockReturnValue('test text');

      const handler = TwinTypeShared.createContentScript({
        provider: 'test',
        findComposer,
        setComposerText,
        sendComposer,
        getComposerText
      });

      const sendResponse = jest.fn();
      handler.handleMessage({ type: 'GET_TEXT' }, null, sendResponse);

      expect(getComposerText).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({
        ok: true,
        text: 'test text',
        provider: 'test'
      });
    });

    it('should handle unknown message type', () => {
      const findComposer = jest.fn();
      const setComposerText = jest.fn();
      const sendComposer = jest.fn();
      const getComposerText = jest.fn();

      const handler = TwinTypeShared.createContentScript({
        provider: 'test',
        findComposer,
        setComposerText,
        sendComposer,
        getComposerText
      });

      const sendResponse = jest.fn();
      handler.handleMessage({ type: 'UNKNOWN' }, null, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({
        ok: false,
        error: 'Unknown message type'
      });
    });
  });
});
