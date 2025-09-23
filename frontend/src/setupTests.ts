class StubResizeObserver implements ResizeObserver {
  readonly callback: ResizeObserverCallback;
  readonly observedElements = new Set<Element>();

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  disconnect(): void {
    this.observedElements.clear();
  }

  observe(target: Element): void {
    this.observedElements.add(target);
  }

  unobserve(target: Element): void {
    this.observedElements.delete(target);
  }

  takeRecords(): ResizeObserverEntry[] {
    return [];
  }
}

if (typeof globalThis.ResizeObserver === "undefined") {
  // @ts-expect-error - jsdom does not provide ResizeObserver by default
  globalThis.ResizeObserver = StubResizeObserver;
}

if (typeof globalThis.requestAnimationFrame === "undefined") {
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback): number =>
    // Use setTimeout to emulate requestAnimationFrame behaviour in tests.
    setTimeout(() => callback(performance.now()), 0) as unknown as number);
}

if (typeof globalThis.cancelAnimationFrame === "undefined") {
  globalThis.cancelAnimationFrame = ((id: number): void => {
    clearTimeout(id);
  });
}

if (typeof globalThis.crypto === "undefined") {
  Object.defineProperty(globalThis, "crypto", {
    value: {
      randomUUID: () => "00000000-0000-0000-0000-000000000000",
    },
  });
} else if (typeof globalThis.crypto.randomUUID !== "function") {
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    value: () => "00000000-0000-0000-0000-000000000000",
  });
}
