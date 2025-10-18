import { SUBSCRIPTION_DEFAULT_GRACE_DAYS } from "@/config/subscription";
import type { AuthSubscription } from "./types";

const MILLISECONDS_IN_DAY = 24 * 60 * 60 * 1000;

const parseTimestamp = (value: string | null): number | null => {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
};

const addDays = (timestamp: number, days: number): number =>
  timestamp + days * MILLISECONDS_IN_DAY;

export const resolveGraceDeadline = (subscription: AuthSubscription | null): Date | null => {
  if (!subscription) {
    return null;
  }

  const fromGrace = parseTimestamp(subscription.graceEndsAt);
  if (fromGrace !== null) {
    return new Date(fromGrace);
  }

  const periodEnd = parseTimestamp(subscription.currentPeriodEnd);
  if (periodEnd !== null) {
    return new Date(addDays(periodEnd, SUBSCRIPTION_DEFAULT_GRACE_DAYS));
  }

  const trialEnd = parseTimestamp(subscription.trialEndsAt);
  if (trialEnd !== null) {
    return new Date(addDays(trialEnd, SUBSCRIPTION_DEFAULT_GRACE_DAYS));
  }

  return null;
};

export type SubscriptionBlockReason =
  | "missing"
  | "inactive"
  | "expired"
  | "grace_expired"
  | "unknown";

export interface SubscriptionAccessEvaluation {
  hasAccess: boolean;
  reason: SubscriptionBlockReason | null;
  graceDeadline: Date | null;
}

export const evaluateSubscriptionAccess = (
  subscription: AuthSubscription | null,
): SubscriptionAccessEvaluation => {
  if (!subscription) {
    return { hasAccess: false, reason: "missing", graceDeadline: null };
  }

  switch (subscription.status) {
    case "active":
    case "trialing":
    case "pending":
      return { hasAccess: true, reason: null, graceDeadline: null };
    case "grace_period":
    case "past_due": {
      const deadline = resolveGraceDeadline(subscription);
      if (deadline && Date.now() <= deadline.getTime()) {
        return { hasAccess: true, reason: null, graceDeadline: deadline };
      }
      return { hasAccess: false, reason: "grace_expired", graceDeadline: deadline };
    }
    case "inactive":
      return { hasAccess: false, reason: "inactive", graceDeadline: null };
    case "expired":
      return { hasAccess: false, reason: "expired", graceDeadline: null };
    default:
      return { hasAccess: false, reason: "unknown", graceDeadline: null };
  }
};
