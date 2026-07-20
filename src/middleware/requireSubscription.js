const UserSubscription = require("../models/UserSubscription");

function isPlatformAdmin(req) {
  return req.user && req.user.userType === "Platform Admin";
}

function isClient(req) {
  return req.user && req.user.userType === "Client";
}

function denySubscription(req, res, message) {
  req.session.subscriptionNotice = message || "Your company needs an active subscription.";
  if (isClient(req)) {
    req.session.toast = { type: "warning", message: "Contact admin. Your company does not have an active subscription." };
    return res.redirect("/activities");
  }
  return res.redirect("/pricing");
}

async function requireActiveSubscription(req, res, next) {
  try {
    if (isPlatformAdmin(req)) return next();
    if (!req.user) return res.redirect("/sign-in");
    if (req.user.userType === "AmobileGuard") return next();

    const companyId = String(req.user.assignedCompanyID || "");
    if (!companyId) return denySubscription(req, res, "Company subscription could not be found.");

    const subscription = await UserSubscription.findOne({
      companyId,
      isActive: true,
      subscriptionStatus: { $in: ["active", "trialing"] },
      $or: [
        { expiresAt: null },
        { expiresAt: { $exists: false } },
        { expiresAt: { $gte: new Date() } }
      ]
    }).sort({ createdAt: -1 });

    if (!subscription) {
      return denySubscription(req, res, "Your company needs an active subscription to view this page.");
    }

    req.userSubscription = subscription;
    res.locals.userSubscription = subscription;
    return next();
  } catch (err) {
    console.error("Subscription middleware error:", err);
    return res.status(500).send("Unable to verify subscription.");
  }
}

// All active plans have full operational access.
function requireFeature() {
  return (req, res, next) => {
    if (isPlatformAdmin(req) || req.userSubscription) return next();
    return denySubscription(req, res);
  };
}

// Numeric operational feature gates no longer block paid plans.
// Account-count limits remain enforced where users/guards are created.
function requireNumericFeature() {
  return (req, res, next) => {
    if (isPlatformAdmin(req) || req.userSubscription) return next();
    return denySubscription(req, res);
  };
}

module.exports = {
  requireActiveSubscription,
  requireFeature,
  requireNumericFeature,
};
