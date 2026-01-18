# CLAUDE.md

This file provides guidance for Claude Code when working on this project.

## Project Overview

TwinType is a Chrome extension (Manifest V3) that mirrors typing to ChatGPT, Gemini, and Claude simultaneously. Users can type once in a side panel and have their text appear in multiple AI chat interfaces at the same time.

## Architecture

```
sidepanel/ → background/service_worker.js → content/*.js
```

- **Side Panel** (`sidepanel/`): User interface for typing and controlling sync
- **Service Worker** (`background/service_worker.js`): Message routing between side panel and content scripts
- **Content Scripts** (`content/`): Inject into AI chat pages to manipulate their composers

### Message Types

- `PING`: Check if content script is loaded and composer is ready
- `SET_TEXT`: Set text in the AI chat's input field
- `SEND`: Click the send button to submit the message

## Key Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension configuration, permissions, content script injection |
| `background/service_worker.js` | Tab management, message routing |
| `sidepanel/sidepanel.js` | UI state management, target selection, sync logic |
| `content/shared.js` | Common utilities shared across all content scripts |
| `content/chatgpt.js` | ChatGPT-specific composer detection and manipulation |
| `content/claude.js` | Claude-specific ProseMirror editor handling |
| `content/gemini.js` | Gemini-specific Quill editor handling |

## Content Script Pattern

All content scripts use the `createContentScript()` factory from `shared.js`:

```javascript
const handler = TwinTypeShared.createContentScript({
  provider: 'name',
  findComposer: () => { /* return composer element */ },
  setComposerText: (text) => { /* set text, return {ok, error} */ },
  sendComposer: () => { /* click send, return {ok, error} */ }
});
handler.init();
```

## Development

### Testing Changes

1. Go to `chrome://extensions/`
2. Click refresh on TwinType card
3. Close and reopen the side panel
4. Refresh any open AI chat tabs

### Debugging

- Service worker: `chrome://extensions/` → Inspect service worker
- Content scripts: DevTools on AI chat page, filter for `[TwinType:]`

## Platform-Specific Notes

- **ChatGPT**: Uses standard `<textarea>` with React controlled input (requires native value setter)
- **Claude**: Uses ProseMirror contenteditable editor
- **Gemini**: Uses Quill rich-text editor with custom data attributes

## Permissions Required

- `storage`: User preferences (theme, live sync state)
- `tabs`: Query active tabs to find AI platforms
- `sidePanel`: Display the extension UI
- `scripting`: Dynamic script injection when needed
- `host_permissions`: Access to chatgpt.com, gemini.google.com, claude.ai
