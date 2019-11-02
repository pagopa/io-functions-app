export const mockStartNew = jest.fn();

export const getClient = jest.fn(() => ({
  startNew: mockStartNew
}));

export const orchestrator = jest.fn();

export const RetryOptions = jest.fn(() => ({}));

export const context = {
  log: {
    error: jest.fn(),
    verbose: jest.fn(),
    warn: jest.fn()
  }
};
