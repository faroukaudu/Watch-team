const UserSubscription = require("../models/UserSubscription");

async function attachSubscription(req, res, next) {
  try {
    if (!req.user) {
      req.userSubscription = null;
      res.locals.userSubscription = null;
      return next();
    }

    // Platform Admin does not require a company subscription.
    if (req.user.userType === "Platform Admin") {
      req.userSubscription = null;
      res.locals.userSubscription = null;
      return next();
    }

    const companyId = String(req.user.assignedCompanyID || "").trim();

    if (!companyId) {
      req.userSubscription = null;
      res.locals.userSubscription = null;
      return next();
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

    req.userSubscription = subscription || null;
    res.locals.userSubscription = subscription || null;
    return next();
  } catch (err) {
    console.error("attachSubscription error:", err);
    req.userSubscription = null;
    res.locals.userSubscription = null;
    return next();
  }
}

module.exports = attachSubscription;
