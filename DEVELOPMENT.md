# Development Guide

## Quick Reference

### Make Commands

```bash
make help           # Show all available commands
make install        # Install npm dependencies
make test           # Run all tests
make test-watch     # Run tests in watch mode
make test-coverage  # Run tests with coverage report
make build          # Create extension package (twintype.zip)
make check          # Run all checks (tests)
make clean          # Remove generated files
```

## Development Workflow

### Initial Setup

```bash
make install
```

This installs all npm dependencies needed for testing.

### Running Tests

```bash
# Quick test run
make test

# Development with auto-reload
make test-watch

# Full coverage report
make test-coverage
```

See [TEST.md](TEST.md) for detailed testing information.

### Building the Extension

```bash
make build
```

Creates `twintype.zip` with only the essential extension files:
- Excludes: tests, node_modules, development files
- Includes: manifest, background, content, sidepanel, icons

### Pre-commit Checks

```bash
make check
```

Runs all tests to ensure code quality before committing.

### Cleaning Up

```bash
make clean
```

Removes:
- `node_modules/`
- `coverage/`
- `twintype.zip`

## Testing Chrome Extension

### Loading the Extension

1. Open Chrome: `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the project directory

### Reloading After Changes

1. Go to `chrome://extensions/`
2. Click refresh icon on TwinType card
3. Close and reopen side panel
4. Refresh any AI chat tabs

### Debugging

**Service Worker:**
1. `chrome://extensions/` → "Inspect views: service worker"
2. Check console for `[TwinType ...]` logs

**Content Scripts:**
1. Open AI chat tab
2. Press F12 for DevTools
3. Filter console for `[TwinType:provider]`

**Side Panel:**
1. Open side panel
2. Right-click → "Inspect"
3. Check console and network tabs

## File Structure

```
twintype/
├── Makefile              # Development commands
├── package.json          # npm dependencies and test config
├── manifest.json         # Extension configuration
│
├── background/           # Service worker
│   └── service_worker.js
│
├── content/              # Content scripts
│   ├── shared.js         # Common utilities
│   ├── chatgpt.js        # ChatGPT integration
│   ├── gemini.js         # Gemini integration
│   └── claude.js         # Claude integration
│
├── sidepanel/            # Side panel UI
│   ├── sidepanel.html
│   ├── sidepanel.css
│   └── sidepanel.js
│
├── icons/                # Extension icons
│
└── __tests__/            # Test suite
    ├── setup.js
    ├── shared.test.js
    ├── service_worker.simple.test.js
    └── sidepanel.simple.test.js
```

## Common Tasks

### Adding a New Feature

1. Write tests first (TDD approach)
2. Implement the feature
3. Run `make test` to verify
4. Test manually in Chrome
5. Run `make check` before committing

### Fixing a Bug

1. Write a failing test that reproduces the bug
2. Fix the bug
3. Verify the test passes
4. Check for regressions with `make check`

### Updating Dependencies

```bash
npm update
npm test  # Ensure tests still pass
```

### Creating a Release

```bash
# Run all checks
make check

# Build the package
make build

# Upload twintype.zip to Chrome Web Store
```

## Continuous Integration

Example GitHub Actions workflow:

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: make install
      - run: make check
```

## Troubleshooting

### Tests Failing

```bash
# Clean and reinstall
make clean
make install
make test
```

### Build Issues

```bash
# Remove old build
rm -f twintype.zip
make build
```

### Node Modules Issues

```bash
# Nuclear option: clean everything
make clean
rm -rf package-lock.json
npm install
make test
```
