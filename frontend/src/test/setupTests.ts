import '@testing-library/jest-dom/vitest';

// Mock clipboard for tests that rely on copy actions
if (typeof navigator !== 'undefined' && !navigator.clipboard) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (navigator as any).clipboard = {
    writeText: async () => {},
  };
}
