export type AnalyticsParams = Record<string, unknown>;

type GtagFunction = (command: string, eventName: string, params?: AnalyticsParams) => void;

type WindowWithAnalytics = Window & {
  gtag?: GtagFunction;
};

const getAnalytics = (): GtagFunction | undefined => {
  if (typeof window === "undefined") {
    return undefined;
  }

  const { gtag } = window as WindowWithAnalytics;
  return typeof gtag === "function" ? gtag : undefined;
};

export const trackEvent = (eventName: string, params: AnalyticsParams = {}): void => {
  const analytics = getAnalytics();

  if (!analytics) {
    return;
  }

  analytics("event", eventName, params);
};
