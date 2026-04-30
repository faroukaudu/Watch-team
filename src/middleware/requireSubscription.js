const UserSubscription = require("../models/UserSubscription");
const { hasFeature, getNumericFeature } = require("../utils/subscriptionAccess");

function isPlatformAdmin(req) {
  return req.user && req.user.userType === "Platform Admin";
}

function redirectToPricingWithNotice(req, res, message) {
  req.session.subscriptionNotice =
    message || "You need an active subscription to view this page.";
  return res.redirect("/pricing");
}

async function requireActiveSubscription(req, res, next) {
  try {
    // Platform Admin → always allowed
    if (isPlatformAdmin(req)) {
      return next();
    }

    // Guard should not use web, but do not force subscription here
    if (req.user && req.user.userType === "AmobileGuard") {
      return next();
    }

    if (!req.user) {
      return res.redirect("/sign-in");
    }

    // Super Admin + Client use the SAME company subscription
    const companyId = req.user.assignedCompanyID;

    if (!companyId) {
      return redirectToPricingWithNotice(
        req,
        res,
        "Company subscription could not be found."
      );
    }

    const subscription = await UserSubscription.findOne({
      companyId: String(companyId),
      isActive: true,
    }).sort({ createdAt: -1 });

    if (!subscription) {
      return redirectToPricingWithNotice(
        req,
        res,
        "Your company needs an active subscription to view this page."
      );
    }

    req.userSubscription = subscription;
    return next();
  } catch (err) {
    console.error("Subscription middleware error:", err);
    return res.status(500).send("Unable to verify subscription.");
  }
}

function requireFeature(featureName) {
  return (req, res, next) => {
    if (isPlatformAdmin(req)) {
      return next();
    }

    if (!req.userSubscription) {
      return redirectToPricingWithNotice(
        req,
        res,
        "Your company needs an active subscription to view this page."
      );
    }

    if (!hasFeature(req.userSubscription, featureName)) {
      return redirectToPricingWithNotice(
        req,
        res,
        "This feature is not available on your current subscription plan."
      );
    }

    return next();
  };
}

function requireNumericFeature(featureName, minValue = 1) {
  return (req, res, next) => {
    if (isPlatformAdmin(req)) {
      return next();
    }

    if (!req.userSubscription) {
      return redirectToPricingWithNotice(
        req,
        res,
        "Your company needs an active subscription to view this page."
      );
    }

    const value = getNumericFeature(req.userSubscription, featureName);

    if (value < minValue) {
      return redirectToPricingWithNotice(
        req,
        res,
        "This feature is not available on your current subscription plan."
      );
    }

    return next();
  };
}

module.exports = {
  requireActiveSubscription,
  requireFeature,
  requireNumericFeature,
};