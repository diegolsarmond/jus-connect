const parseDuration = (rawValue: string | undefined, fallback: number): number => {
  if (typeof rawValue === 'string') {
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
  process.env.SUBSCRIPTION_TRIAL_DAYS,
  14,
);

export const SUBSCRIPTION_GRACE_DAYS_MONTHLY = parseDuration(
  process.env.SUBSCRIPTION_GRACE_DAYS_MONTHLY,
  7,
);

export const SUBSCRIPTION_GRACE_DAYS_ANNUAL = parseDuration(
  process.env.SUBSCRIPTION_GRACE_DAYS_ANNUAL,
  30,
);

export const SUBSCRIPTION_DEFAULT_GRACE_DAYS = SUBSCRIPTION_GRACE_DAYS_MONTHLY;

export default {
  SUBSCRIPTION_TRIAL_DAYS,
  SUBSCRIPTION_GRACE_DAYS_MONTHLY,
  SUBSCRIPTION_GRACE_DAYS_ANNUAL,
  SUBSCRIPTION_DEFAULT_GRACE_DAYS,
};
