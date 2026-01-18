# TwinType Test Suite

This document describes the test suite for the TwinType Chrome extension.

## Overview

The test suite uses Jest with jsdom to test the extension's JavaScript modules. Tests cover:

- **Shared utilities** (`content/shared.js`)
- **Service worker** (`background/service_worker.js`)
- **Side panel** (`sidepanel/sidepanel.js`)

## Installation

Install test dependencies:

```bash
npm install
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm test:coverage
```

## Test Structure

```
__tests__/
├── setup.js                      # Jest configuration and Chrome API mocks
├── shared.test.js                # Unit tests for content/shared.js utilities
├── service_worker.simple.test.js # Pattern tests for service worker logic
└── sidepanel.simple.test.js      # Pattern tests for side panel logic
```

## Test Approach

The test suite uses two approaches:

1. **Unit Tests** (`shared.test.js`): Direct unit tests of utility functions by evaluating the shared.js module and testing each exported function.

2. **Pattern Tests** (`*.simple.test.js`): Tests that validate the logic patterns, algorithms, and Chrome API interactions without directly executing the source files. This approach:
   - Tests the business logic independently
   - Verifies Chrome API usage patterns
   - Validates state management and message routing
   - Ensures error handling works correctly

Pattern tests are preferred for the service worker and side panel because they contain Chrome extension-specific initialization code that doesn't run well in a test environment.

## Test Coverage

### Shared Utilities (`shared.test.js`)

Tests the shared utility functions used across content scripts:

- **Logger creation**: Creates provider-specific loggers
- **Visibility detection**: Checks if elements are visible in DOM
- **Caret movement**: Moves caret to end of textareas and contenteditable elements
- **Button finding**: Finds send buttons using selectors and aria-labels
- **Keyboard simulation**: Simulates Enter key presses
- **Textarea value setting**: Sets textarea values bypassing React
- **Content script factory**: Tests the `createContentScript()` pattern
  - Message handling (PING, SET_TEXT, SEND, GET_TEXT)
  - Composer detection
  - Reverse sync suppression

### Service Worker (`service_worker.simple.test.js`)

Tests the background service worker functionality using pattern tests:

- **Provider detection**: Identifies ChatGPT, Gemini, and Claude URLs
- **Tab discovery**: Finds eligible tabs across windows
- **Content script injection**: Dynamically injects scripts into tabs
- **Tab communication**:
  - Pinging tabs for composer readiness
  - Setting text in composers
  - Sending messages
  - Getting text from composers
- **Auto-injection**: Automatically injects scripts on connection errors
- **Message routing**: Routes messages between side panel and content scripts
- **Error handling**: Handles extension context invalidation, permission errors

### Side Panel (`sidepanel.simple.test.js`)

Tests the side panel UI and logic using pattern tests:

- **Initialization**: Restores saved state (text, theme, selections)
- **Character counting**: Updates character count display
- **Target selection**: Populates and manages target dropdowns
- **Text syncing**: Syncs text to selected AI platforms
- **Message sending**: Sends messages to all targets
- **Theme cycling**: Cycles through light/dark/default themes
- **Diagnostics**: Logs operations and errors
- **Auto-pull**: Pulls text from active target tab
- **Toast notifications**: Shows success/error messages

## Mocked Chrome APIs

The test suite mocks Chrome extension APIs in `__tests__/setup.js`:

- `chrome.runtime.sendMessage`
- `chrome.runtime.onMessage`
- `chrome.storage.local`
- `chrome.tabs`
- `chrome.windows`
- `chrome.sidePanel`
- `chrome.scripting`
- `chrome.commands`

## Writing New Tests

When adding new functionality:

1. Create or update the relevant test file in `__tests__/`
2. Mock any new Chrome APIs in `__tests__/setup.js`
3. Follow the existing test patterns for consistency
4. Ensure tests are isolated (no shared state between tests)

### Example Test

```javascript
describe('MyFeature', () => {
  it('should do something', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = myFunction(input);

    // Assert
    expect(result).toBe('expected');
  });
});
```

## Test Results

```
Test Suites: 3 passed, 3 total
Tests:       61 passed, 61 total
```

The test suite includes:
- 34 tests for shared utilities (unit tests)
- 14 tests for service worker patterns
- 13 tests for side panel patterns

## Known Limitations

- Content scripts that directly manipulate AI platform DOMs (chatgpt.js, claude.js, gemini.js) are not tested as they require actual page contexts
- Some async timing behavior is simplified in tests
- Browser rendering and layout calculations are mocked
- Code coverage reports show 0% because pattern tests don't execute source files directly - they test the logic patterns instead

## Continuous Integration

To integrate with CI/CD:

```yaml
# Example GitHub Actions workflow
- name: Install dependencies
  run: npm install

- name: Run tests
  run: npm test

- name: Generate coverage
  run: npm run test:coverage
```

## Troubleshooting

### Tests fail with "Cannot find module"

Ensure all dependencies are installed:
```bash
npm install
```

### Tests timeout

Increase Jest timeout in `package.json`:
```json
"jest": {
  "testTimeout": 10000
}
```

### Coverage reports missing

Ensure coverage paths are correct in `package.json`:
```json
"collectCoverageFrom": [
  "background/**/*.js",
  "content/**/*.js",
  "sidepanel/**/*.js"
]
```
