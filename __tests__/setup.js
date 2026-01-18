// Jest setup file for Chrome Extension testing

// Mock Chrome APIs
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    lastError: null
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn()
    }
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn(),
    onActivated: {
      addListener: jest.fn()
    }
  },
  windows: {
    getAll: jest.fn(),
    onFocusChanged: {
      addListener: jest.fn()
    },
    WINDOW_ID_NONE: -1
  },
  sidePanel: {
    setPanelBehavior: jest.fn().mockResolvedValue(undefined),
    open: jest.fn().mockResolvedValue(undefined)
  },
  scripting: {
    executeScript: jest.fn()
  },
  commands: {
    onCommand: {
      addListener: jest.fn()
    }
  }
};

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};
