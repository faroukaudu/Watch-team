const UserSubscription = require("../models/UserSubscription");
const { PLAN_CONFIG } = require("../config/subscriptionPlans");

function normalizePlanKey(planCode = "") {
  const key = String(planCode).trim().toLowerCase();

  if (key === "essential_monthly" || key === "essential_yearly") return "essential";
  if (key === "advanced_monthly" || key === "advanced_yearly") return "advanced";
  if (key === "professional_monthly" || key === "professional_yearly") return "professional";

  return "essential";
}

function getPlanFallbackFeatures(planCode = "") {
  const planKey = normalizePlanKey(planCode);

  const fallbackMap = {
    essential: {
      maxSuperAdmins: 1,
      maxClients: 2,
      maxSecurityGuards: 3,
      maxPostSites: 3,
    },
    advanced: {
      maxSuperAdmins: 2,
      maxClients: 5,
      maxSecurityGuards: 6,
      maxPostSites: 6,
    },
    professional: {
      maxSuperAdmins: -1,
      maxClients: -1,
      maxSecurityGuards: -1,
      maxPostSites: -1,
    },
  };

  return fallbackMap[planKey] || fallbackMap.essential;
}

async function getCompanySubscription(companyId) {
  if (!companyId) return null;

  const subscription = await UserSubscription.findOne({
    companyId: String(companyId),
    isActive: true,
  }).sort({ createdAt: -1 });

  return subscription;
}

async function getResolvedFeatures(companyId) {
  const subscription = await getCompanySubscription(companyId);

  if (!subscription) {
    return getPlanFallbackFeatures("essential_monthly");
  }

  const dbFeatures = subscription.features || {};
  const fallbackFeatures = getPlanFallbackFeatures(subscription.planCode || "");

  return {
    ...fallbackFeatures,
    ...dbFeatures,
  };
}

function isUnlimited(value) {
  return value === -1;
}

function getLimitValue(features, key) {
  if (!features) return 0;
  if (typeof features[key] === "number") return features[key];
  return 0;
}

module.exports = {
  getCompanySubscription,
  getResolvedFeatures,
  getLimitValue,
  isUnlimited,
};