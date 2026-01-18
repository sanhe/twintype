# TwinType

A Chrome extension that mirrors your typing to ChatGPT, Gemini, and Claude simultaneously — perfect for comparing AI responses without retyping prompts.

## Features

- **Live Sync**: Text mirrors to selected AI tabs as you type
- **Explicit Targeting**: Select specific tabs (Target A and Target B) to mirror to
- **Multi-window Support**: Works across multiple browser windows
- **Send to Selected**: Submit your prompt to selected targets at once
- **System Theme**: Follows your OS light/dark mode automatically
- **Diagnostics Panel**: Debug connection issues with detailed status info

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **Load unpacked**
5. Select the `twintype` directory

## Usage

### Opening the Side Panel

- **Keyboard**: Press `Cmd+Shift+T` (Mac) or `Ctrl+Shift+T` (Windows/Linux)
- **Click**: Click the TwinType extension icon in your toolbar

### Basic Workflow

1. Open AI chat tabs (ChatGPT, Gemini, and/or Claude) in your browser
2. Make sure the AI tab is the **active tab** in its window
3. Open the TwinType side panel
4. **Select Targets**: Use the dropdowns to choose which tabs to mirror to (Target A is required, Target B is optional)
5. Type your prompt in the input area
6. Text automatically mirrors to selected targets (if Live Sync is on)
7. Click **Send** or press `Enter` to submit to selected targets

### Controls

| Control | Action |
|---------|--------|
| **Live Sync** toggle | Enable/disable real-time mirroring |
| **Sync Now** button | Manual sync (when Live Sync is off) |
| **Send** button | Submit prompt to all connected tabs |
| **Clear** button | Clear the input field |
| **Refresh** ↻ | Re-scan for active AI tabs |
| **Theme** ☀️/🌙 | Cycle through System → Light → Dark |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Send to all tabs |
| `Shift+Enter` | New line (doesn't send) |
| `Cmd/Ctrl+Shift+T` | Open/focus side panel |

## Status Indicators

The "Active Tabs" section shows connected AI tabs:

| Indicator | Meaning |
|-----------|---------|
| 🟢 Green dot | Connected and ready |
| 🔴 Red dot | Connection issue (see reason below) |

### Common Status Reasons

| Reason | Cause | Solution |
|--------|-------|----------|
| `no receiver` | Content script not loaded | Refresh the AI tab |
| `composer not found` | Chat input not detected | Navigate to a chat page |
| `permission denied` | Extension lacks access | Check host permissions |

## Supported Platforms

| Platform | URL | Status |
|----------|-----|--------|
| ChatGPT | `chatgpt.com` | ✅ Supported |
| Google Gemini | `gemini.google.com` | ✅ Supported |
| Claude | `claude.ai` | ✅ Supported |

## Troubleshooting

### Tabs not appearing in status list

- Ensure the AI tab is the **active/visible** tab in its window
- Only one tab per window can be active
- Background tabs are intentionally not connected

### "No receiver" error

1. Refresh the AI chat page
2. If that doesn't work, reload the extension at `chrome://extensions/`
3. Close and reopen the side panel

### Text not syncing

1. Check that the status dot is green
2. Ensure you're on a chat page (not settings/home)
3. Wait for the page to fully load
4. Click the Refresh ↻ button

### Diagnostics

Expand the **Diagnostics** section in the side panel to see:
- Connection attempts and results
- Sync success/failure messages
- Detailed error information

## Technical Details

### Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Side Panel    │────▶│  Service Worker  │────▶│ Content Scripts │
│  (sidepanel.*)  │     │ (service_worker) │     │ (chatgpt/gemini │
│                 │◀────│                  │◀────│  /claude.js)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### Message Flow

1. **PING**: Side panel → Background → Content script → Returns composer status
2. **SET_TEXT**: Side panel → Background → Content script → Sets text in composer
3. **SEND**: Side panel → Background → Content script → Clicks send button

### Files

```
twintype/
├── manifest.json           # Extension configuration
├── background/
│   └── service_worker.js   # Tab management, message routing
├── sidepanel/
│   ├── sidepanel.html      # Side panel UI
│   ├── sidepanel.css       # Styles (system theme support)
│   └── sidepanel.js        # UI logic, state management
├── content/
│   ├── chatgpt.js          # ChatGPT composer detection
│   ├── gemini.js           # Gemini composer detection
│   └── claude.js           # Claude composer detection
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Permissions

| Permission | Purpose |
|------------|---------|
| `storage` | Save user preferences (theme, live sync) |
| `tabs` | Query active tabs, detect AI platforms |
| `sidePanel` | Display the side panel UI |
| `host_permissions` | Inject content scripts into AI sites |

## Development

### Debugging

1. Open `chrome://extensions/`
2. Find TwinType and click **Inspect views: service worker**
3. Check console for `[TwinType ...]` logs

For content script logs:
1. Open an AI chat tab
2. Open DevTools (`F12`)
3. Look for `[TwinType:provider]` messages

### Reloading Changes

After modifying files:
1. Go to `chrome://extensions/`
2. Click the refresh icon on the TwinType card
3. Close and reopen the side panel
4. Refresh any open AI chat tabs

## License

MIT License - feel free to modify and distribute.
