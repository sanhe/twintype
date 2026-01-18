# Task: Reverse sync (chat -> panel) as an option, active-target only

## Goal
Add an optional reverse mirroring mode so that draft text in the selected target chat composer appears in the Side Panel input, and updates live while the user types in the chat.

## User requirements
1) If there is draft text in a target chat composer, it should appear in the Side Panel input.
2) If BOTH targets have draft text, pull ONLY from the ACTIVE target tab (no concatenation).
3) When the user types in the active target chat composer, the Side Panel input updates live (chat -> panel).
4) This must be an OPTION (default OFF).

## UI
- Add a toggle: **“Auto-pull from active target (chat → panel)”** (default OFF).
- Show a small status line when ON: **Source: <Provider> — <Tab Title>**.
- Keep “system settings” UI style.

## Scope rules
- Reverse sync listens ONLY on selected target tabs (Target A and Target B).
- When both targets exist, the reverse-sync source is ONLY the currently active target tab.

## Loop prevention (critical)
We now have bidirectional behavior; must prevent feedback loops:
- Content scripts must suppress reverse events caused by programmatic SET_TEXT from the panel:
    - set a local `suppressReverse` flag and/or ignore input events for ~300–800ms after applying SET_TEXT.
- Side Panel must suppress panel->chat mirroring when it is updating its textarea from chat events:
    - use a local flag like `updatingFromChat` so the textarea change does not trigger SET_TEXT back to chats.
- Auto-pull must not instantly re-push to chats. Panel->chat happens only when user types in panel or presses Sync Now/Send.

## Technical design
### New message/event types
- Side panel -> background -> tab content script:
    - `GET_TEXT`
- Content script -> background:
    - `COMPOSER_CHANGED` with `{ tabId, text }` (user-typed only)
- Background -> side panel:
    - `ACTIVE_TARGET_TEXT` with `{ provider, tabId, title, text }`

### Active target definition
- Track active tab per window via `tabs.onActivated` + `windows.onFocusChanged`.
- Active target tab = the focused window’s active tab if it is Target A or B; otherwise choose the most recently activated target.

### Content scripts (chatgpt/gemini/claude)
- Implement `GET_TEXT` to return current composer draft.
- Attach input listeners to composer to send `COMPOSER_CHANGED` when user types.
- Use MutationObserver to re-bind on re-render.
- Apply suppression when SET_TEXT is called programmatically.

### Side panel
- Add toggle and persist in `chrome.storage.local`.
- When toggle ON:
    - on activation change (notified by background), request GET_TEXT from active target and set textarea (do not clear if empty).
- When receiving `ACTIVE_TARGET_TEXT` updates:
    - set textarea without triggering panel->chat mirror.

## Acceptance criteria (Definition of Done)
1) Auto-pull OFF: existing behavior unchanged.
2) Auto-pull ON:
    - Switching focus to a target tab with draft text updates the panel input to that draft.
    - If both targets have drafts, the panel shows ONLY the active target’s draft.
    - Typing in the active target composer updates the panel input live.
    - No flicker / no infinite loop / no immediate overwrite back into chats.
3) Works for at least ChatGPT + Gemini; ideally Claude as well.
4) If a target is not connected/composer not ready:
    - still works for the other target
    - shows a clear reason in UI.

## Files likely impacted
- background/service_worker.js
- sidepanel/sidepanel.{html,css,js}
- content/chatgpt.js
- content/gemini.js
- content/claude.js
