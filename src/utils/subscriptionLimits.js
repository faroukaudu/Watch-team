const UserSubscription = require("../models/UserSubscription");
const {
  PLAN_CONFIG,
  BASIC_LIMITS,
  ADVANCED_LIMITS,
  PROFESSIONAL_LIMITS,
} = require("../config/subscriptionPlans");

function normalizePlanKey(planCode = "") {
  const key = String(planCode).trim().toLowerCase();

  if (
    key === "basic" ||
    key === "basic_monthly" ||
    key === "basic_yearly" ||
    key === "essential" ||
    key === "essential_monthly" ||
    key === "essential_yearly"
  ) {
    return "basic";
  }

  if (
    key === "advanced" ||
    key === "advanced_monthly" ||
    key === "advanced_yearly"
  ) {
    return "advanced";
  }

  if (
    key === "professional" ||
    key === "professional_monthly" ||
    key === "professional_yearly"
  ) {
    return "professional";
  }

  return "basic";
}

function getAuthoritativePlanLimits(planCode = "") {
  const planKey = normalizePlanKey(planCode);

  if (planKey === "advanced") return { ...ADVANCED_LIMITS };
  if (planKey === "professional") return { ...PROFESSIONAL_LIMITS };
  return { ...BASIC_LIMITS };
}

function getPlanFallbackFeatures(planCode = "") {
  const limits = getAuthoritativePlanLimits(planCode);

  return {
    ...limits,
    dashboard: true,
    activity: true,
    clients: true,
    securityTeam: true,
    timeClock: true,
    reportingDays: -1,
    gpsTrackingDays: -1,
    geofenceDays: -1,
    messenger: true,
    siteTourDays: -1,
    taskDays: -1,
    checklistDays: -1,
    supportLevel: "full",
  };
}

async function getCompanySubscription(companyId) {
  if (!companyId) return null;

  return UserSubscription.findOne({
    companyId: String(companyId),
    isActive: true,
  }).sort({ createdAt: -1 });
}

async function getResolvedFeatures(companyId) {
  const subscription = await getCompanySubscription(companyId);

  if (!subscription) {
    return getPlanFallbackFeatures("basic");
  }

  const dbFeatures =
    subscription.features && typeof subscription.features.toObject === "function"
      ? subscription.features.toObject()
      : subscription.features || {};

  const planCode =
    subscription.planCode ||
    subscription.planName ||
    "basic";

  const fallbackFeatures = getPlanFallbackFeatures(planCode);
  const authoritativeLimits = getAuthoritativePlanLimits(planCode);

  /*
   * Feature values may come from the subscription record, but count limits
   * always come from the master plan configuration. This prevents old
   * subscription documents from preserving incorrect or unlimited limits.
   */
  return {
    ...fallbackFeatures,
    ...dbFeatures,
    ...authoritativeLimits,
  };
}

function isUnlimited(value) {
  return Number(value) === -1;
}

function getLimitValue(features, key) {
  if (!features) return 0;

  const value = Number(features[key]);
  return Number.isFinite(value) ? value : 0;
}

function isPlatformAdmin(user) {
  return String(user?.userType || "").trim() === "Platform Admin";
}

module.exports = {
  normalizePlanKey,
  getAuthoritativePlanLimits,
  getPlanFallbackFeatures,
  getCompanySubscription,
  getResolvedFeatures,
  getLimitValue,
  isUnlimited,
  isPlatformAdmin,
};
