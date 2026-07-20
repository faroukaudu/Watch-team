const UserSubscription = require("../models/UserSubscription");
const {
  denyClientSupport,
  requirePlanUpgrade,
} = require("../utils/accessResponse");

function normalize(value = "") {
  return String(value).trim().toLowerCase();
}

function isAdvancedOrProfessional(planCode = "") {
  const code = normalize(planCode);
  return code.includes("advanced") || code.includes("professional");
}

function requirePremiumWebFeature(featureName) {
  return async function premiumWebFeatureMiddleware(req, res, next) {
    try {
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.redirect("/sign-in");
      }

      const userType = String(req.user?.userType || "").trim();

      // Platform Admin always has access.
      if (userType === "Platform Admin") {
        return next();
      }

      // Clients never access these selected modules.
      if (userType === "Client") {
        return denyClientSupport(req, res, featureName);
      }

      const companyId = String(req.user?.assignedCompanyID || "").trim();

      const subscription = companyId
        ? await UserSubscription.findOne({
            companyId,
            isActive: true,
            subscriptionStatus: { $in: ["active", "trialing"] },
            $or: [
              { expiresAt: null },
              { expiresAt: { $exists: false } },
              { expiresAt: { $gte: new Date() } },
            ],
          })
            .sort({ createdAt: -1 })
            .lean()
        : null;

      if (!subscription || !isAdvancedOrProfessional(subscription.planCode)) {
        return requirePlanUpgrade(req, res, featureName);
      }

      req.userSubscription = subscription;
      res.locals.userSubscription = subscription;
      return next();
    } catch (error) {
      console.error(`${featureName} access check error:`, error);
      return res.status(500).send(`Unable to verify access to ${featureName}.`);
    }
  };
}

module.exports = {
  requirePremiumWebFeature,
  isAdvancedOrProfessional,
};
