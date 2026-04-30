const UserSubscription = require("../models/UserSubscription");

async function attachSubscription(req, res, next) {
  try {
    if (!req.user) {
      req.userSubscription = null;
      res.locals.userSubscription = null;
      return next();
    }

    const sub = await UserSubscription.findOne({
      userId: req.user._id,
      companyId: String(req.user.assignedCompanyID || ""),
    }).lean();

    req.userSubscription = sub;
    res.locals.userSubscription = sub;
    return next();
  } catch (err) {
    console.error("attachSubscription error:", err);
    req.userSubscription = null;
    res.locals.userSubscription = null;
    return next();
  }
}

module.exports = attachSubscription;