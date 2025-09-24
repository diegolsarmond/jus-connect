export type GtagFunction = (...args: unknown[]) => void;

type GtagWindow = typeof window & { gtag?: GtagFunction };

export const getGtag = (): GtagFunction | undefined => {
  if (typeof window === "undefined") {
    return undefined;
  }

  return (window as GtagWindow).gtag;
};
