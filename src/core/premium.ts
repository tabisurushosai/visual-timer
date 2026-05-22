export type PremiumEntitlement = "free" | "trial" | "premium";

export interface PremiumAccess {
  readonly entitlement: PremiumEntitlement;
  readonly trialStartedAtMs: number | null;
  readonly purchasedAtMs: number | null;
}

export interface PremiumStatus {
  readonly access: PremiumAccess;
  readonly isPremium: boolean;
  readonly isTrialActive: boolean;
  readonly trialEndsAtMs: number | null;
  readonly trialDaysRemaining: number;
}

export const PREMIUM_TRIAL_DAYS = 7;
export const PREMIUM_TRIAL_MS = PREMIUM_TRIAL_DAYS * 24 * 60 * 60 * 1000;
export const STRIPE_CHECKOUT_URL = "https://checkout.stripe.com/";
export const FREE_PRESET_LIMIT = 1;
export const PREMIUM_PRESET_LIMIT = 8;

const DEFAULT_PREMIUM_ACCESS: PremiumAccess = {
  entitlement: "free",
  trialStartedAtMs: null,
  purchasedAtMs: null,
};

function normalizeTimestamp(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.trunc(value) : null;
}

export function normalizePremiumAccess(value: unknown): PremiumAccess {
  if (typeof value !== "object" || value === null) {
    return DEFAULT_PREMIUM_ACCESS;
  }

  const entitlementValue = "entitlement" in value ? value.entitlement : null;
  const entitlement: PremiumEntitlement =
    entitlementValue === "trial" || entitlementValue === "premium" ? entitlementValue : "free";

  return {
    entitlement,
    trialStartedAtMs: normalizeTimestamp("trialStartedAtMs" in value ? value.trialStartedAtMs : null),
    purchasedAtMs: normalizeTimestamp("purchasedAtMs" in value ? value.purchasedAtMs : null),
  };
}

export function getPremiumStatus(access: PremiumAccess, nowMs: number): PremiumStatus {
  const trialEndsAtMs = access.trialStartedAtMs === null ? null : access.trialStartedAtMs + PREMIUM_TRIAL_MS;
  const isTrialActive = access.entitlement === "trial" && trialEndsAtMs !== null && nowMs < trialEndsAtMs;
  const isPremium = access.entitlement === "premium" || isTrialActive;
  const trialDaysRemaining =
    isTrialActive && trialEndsAtMs !== null ? Math.max(1, Math.ceil((trialEndsAtMs - nowMs) / (24 * 60 * 60 * 1000))) : 0;

  return {
    access,
    isPremium,
    isTrialActive,
    trialEndsAtMs,
    trialDaysRemaining,
  };
}

export function startPremiumTrial(access: PremiumAccess, nowMs: number): PremiumAccess {
  if (access.entitlement === "premium" || access.trialStartedAtMs !== null) {
    return access;
  }

  return {
    ...access,
    entitlement: "trial",
    trialStartedAtMs: Math.trunc(nowMs),
  };
}

export function getPresetLimit(status: PremiumStatus): number {
  return status.isPremium ? PREMIUM_PRESET_LIMIT : FREE_PRESET_LIMIT;
}
