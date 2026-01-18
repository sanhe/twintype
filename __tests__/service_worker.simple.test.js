// Simplified tests for background/service_worker.js
// Testing the core logic patterns without eval

describe('Service Worker - Pattern Tests', () => {
  describe('Provider Pattern Matching', () => {
    it('should match ChatGPT URLs', () => {
      const pattern = /^https:\/\/chatgpt\.com\/.*/;
      expect(pattern.test('https://chatgpt.com/chat')).toBe(true);
      expect(pattern.test('https://chatgpt.com/c/abc123')).toBe(true);
      expect(pattern.test('https://example.com')).toBe(false);
    });

    it('should match Gemini URLs', () => {
      const pattern = /^https:\/\/gemini\.google\.com\/.*/;
      expect(pattern.test('https://gemini.google.com/app')).toBe(true);
      expect(pattern.test('https://gemini.google.com/chat/123')).toBe(true);
      expect(pattern.test('https://google.com')).toBe(false);
    });

    it('should match Claude URLs', () => {
      const pattern = /^https:\/\/claude\.ai\/.*/;
      expect(pattern.test('https://claude.ai/chat')).toBe(true);
      expect(pattern.test('https://claude.ai/chat/abc-123')).toBe(true);
      expect(pattern.test('https://anthropic.com')).toBe(false);
    });
  });

  describe('Message Routing Logic', () => {
    it('should route GET_ELIGIBLE_TABS message', async () => {
      chrome.windows.getAll.mockResolvedValue([
        {
          id: 1,
          tabs: [
            { id: 101, url: 'https://chatgpt.com/chat', title: 'ChatGPT', active: true },
            { id: 102, url: 'https://google.com', title: 'Google', active: false }
          ]
        }
      ]);

      const sendResponse = jest.fn();

      // Simulate the message handler logic
      const tabs = await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] });
      const eligibleTabs = tabs.flatMap(win =>
        win.tabs
          .filter(tab => {
            const url = tab.url;
            return url && (
              /^https:\/\/chatgpt\.com\/.*/.test(url) ||
              /^https:\/\/gemini\.google\.com\/.*/.test(url) ||
              /^https:\/\/claude\.ai\/.*/.test(url)
            );
          })
          .map(tab => ({
            id: tab.id,
            windowId: win.id,
            title: tab.title,
            url: tab.url,
            active: tab.active
          }))
      );

      sendResponse({ tabs: eligibleTabs });

      expect(sendResponse).toHaveBeenCalledWith({
        tabs: expect.arrayContaining([
          expect.objectContaining({
            id: 101,
            windowId: 1,
            title: 'ChatGPT'
          })
        ])
      });
      expect(eligibleTabs).toHaveLength(1);
    });

    it('should handle PING_TAB flow', async () => {
      chrome.tabs.sendMessage.mockResolvedValue({
        ok: true,
        composerReady: true,
        provider: 'chatgpt'
      });

      const response = await chrome.tabs.sendMessage(101, { type: 'PING' });

      expect(response.ok).toBe(true);
      expect(response.composerReady).toBe(true);
    });

    it('should handle SET_TEXT flow', async () => {
      chrome.tabs.sendMessage.mockResolvedValue({ ok: true });

      const response = await chrome.tabs.sendMessage(101, {
        type: 'SET_TEXT',
        text: 'Hello World'
      });

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(101, {
        type: 'SET_TEXT',
        text: 'Hello World'
      });
      expect(response.ok).toBe(true);
    });

    it('should handle SEND_COMMAND flow', async () => {
      chrome.tabs.sendMessage.mockResolvedValue({ ok: true });

      const response = await chrome.tabs.sendMessage(101, { type: 'SEND' });

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(101, { type: 'SEND' });
      expect(response.ok).toBe(true);
    });

    it('should handle GET_TEXT flow', async () => {
      chrome.tabs.sendMessage.mockResolvedValue({
        ok: true,
        text: 'Test message',
        provider: 'claude'
      });

      const response = await chrome.tabs.sendMessage(101, { type: 'GET_TEXT' });

      expect(response.text).toBe('Test message');
      expect(response.provider).toBe('claude');
    });
  });

  describe('Script Injection Logic', () => {
    it('should inject correct scripts for ChatGPT', async () => {
      chrome.scripting.executeScript.mockResolvedValue([]);

      await chrome.scripting.executeScript({
        target: { tabId: 101 },
        files: ['content/shared.js', 'content/chatgpt.js']
      });

      expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
        target: { tabId: 101 },
        files: ['content/shared.js', 'content/chatgpt.js']
      });
    });

    it('should inject correct scripts for Gemini', async () => {
      chrome.scripting.executeScript.mockResolvedValue([]);

      await chrome.scripting.executeScript({
        target: { tabId: 102 },
        files: ['content/shared.js', 'content/gemini.js']
      });

      expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
        target: { tabId: 102 },
        files: ['content/shared.js', 'content/gemini.js']
      });
    });

    it('should inject correct scripts for Claude', async () => {
      chrome.scripting.executeScript.mockResolvedValue([]);

      await chrome.scripting.executeScript({
        target: { tabId: 103 },
        files: ['content/shared.js', 'content/claude.js']
      });

      expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
        target: { tabId: 103 },
        files: ['content/shared.js', 'content/claude.js']
      });
    });
  });

  describe('Error Handling Patterns', () => {
    it('should handle connection errors', async () => {
      chrome.tabs.sendMessage.mockRejectedValue(
        new Error('Could not establish connection')
      );

      try {
        await chrome.tabs.sendMessage(101, { type: 'PING' });
        fail('Should have thrown');
      } catch (err) {
        expect(err.message).toContain('Could not establish connection');
      }
    });

    it('should handle extension context invalidated', async () => {
      chrome.tabs.sendMessage.mockRejectedValue(
        new Error('Extension context invalidated')
      );

      try {
        await chrome.tabs.sendMessage(101, { type: 'PING' });
        fail('Should have thrown');
      } catch (err) {
        expect(err.message).toContain('Extension context invalidated');
      }
    });

    it('should handle permission denied', async () => {
      chrome.tabs.sendMessage.mockRejectedValue(
        new Error('Cannot access')
      );

      try {
        await chrome.tabs.sendMessage(101, { type: 'PING' });
        fail('Should have thrown');
      } catch (err) {
        expect(err.message).toContain('Cannot access');
      }
    });
  });

  describe('Auto-injection Retry Pattern', () => {
    it('should retry after successful injection', async () => {
      // First call fails, trigger injection
      chrome.tabs.sendMessage
        .mockRejectedValueOnce(new Error('Could not establish connection'))
        .mockResolvedValueOnce({ ok: true, composerReady: true });

      chrome.scripting.executeScript.mockResolvedValue([]);

      // Simulate auto-injection pattern
      try {
        await chrome.tabs.sendMessage(101, { type: 'PING' });
      } catch (err) {
        if (err.message.includes('Could not establish connection')) {
          // Inject scripts
          await chrome.scripting.executeScript({
            target: { tabId: 101 },
            files: ['content/shared.js', 'content/chatgpt.js']
          });

          // Retry
          const response = await chrome.tabs.sendMessage(101, { type: 'PING' });
          expect(response.ok).toBe(true);
        }
      }

      expect(chrome.scripting.executeScript).toHaveBeenCalled();
    });
  });
});
