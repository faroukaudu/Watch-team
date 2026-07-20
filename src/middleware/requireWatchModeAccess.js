const UserSubscription = require("../models/UserSubscription");
const {
  denyClientAccess,
  requirePlanUpgrade,
} = require("../utils/accessResponse");

function normalizePlanCode(value = "") {
  return String(value).trim().toLowerCase();
}

function isEligibleWatchModePlan(planCode = "") {
  const code = normalizePlanCode(planCode);
  return code.includes("advanced") || code.includes("professional");
}

async function requireWatchModeAccess(req, res, next) {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.redirect("/sign-in");
    }

    const userType = String(req.user?.userType || "").trim();

    // Platform Admin always has access to every feature.
    if (userType === "Platform Admin") {
      return next();
    }

    // Clients never have access to Watch Mode.
    if (userType === "Client") {
      return denyClientAccess(req, res, "Watch Mode");
    }

    const companyId = String(req.user?.assignedCompanyID || "").trim();

    if (!companyId) {
      return requirePlanUpgrade(req, res, "Watch Mode");
    }

    const subscription = await UserSubscription.findOne({
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
      .lean();

    if (!subscription || !isEligibleWatchModePlan(subscription.planCode)) {
      return requirePlanUpgrade(req, res, "Watch Mode");
    }

    req.userSubscription = subscription;
    res.locals.userSubscription = subscription;
    return next();
  } catch (error) {
    console.error("Watch Mode access check error:", error);
    return res.status(500).send("Unable to verify Watch Mode access.");
  }
}

module.exports = {
  requireWatchModeAccess,
  isEligibleWatchModePlan,
};
