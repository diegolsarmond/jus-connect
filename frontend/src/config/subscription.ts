const parseDuration = (rawValue: string | undefined, fallback: number): number => {
  if (typeof rawValue === "string") {
    const trimmed = rawValue.trim();
    if (trimmed) {
      const parsed = Number.parseInt(trimmed, 10);
      if (Number.isFinite(parsed) && parsed >= 0) {
        return parsed;
      }
    }
  }

  return fallback;
};

export const SUBSCRIPTION_TRIAL_DAYS = parseDuration(
  import.meta.env.VITE_SUBSCRIPTION_TRIAL_DAYS as string | undefined,
  14,
);

const rawGraceFallback =
  (import.meta.env.VITE_SUBSCRIPTION_GRACE_DAYS_FALLBACK as string | undefined) ??
  (import.meta.env.VITE_SUBSCRIPTION_GRACE_DAYS_MONTHLY as string | undefined);

export const SUBSCRIPTION_DEFAULT_GRACE_DAYS = parseDuration(rawGraceFallback, 7);

export default {
  SUBSCRIPTION_TRIAL_DAYS,
  SUBSCRIPTION_DEFAULT_GRACE_DAYS,
};
