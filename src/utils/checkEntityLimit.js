const { getResolvedFeatures, getLimitValue, isUnlimited } = require("./subscriptionLimits");
const { redirectToPricingWithUpgradeMessage } = require("./upgradeRedirect");

async function enforceEntityLimit({
  req,
  res,
  companyId,
  featureKey,
  model,
  query,
  entityLabel,
}) {
  const features = await getResolvedFeatures(companyId);
  const limit = getLimitValue(features, featureKey);

  if (isUnlimited(limit)) {
    return { allowed: true };
  }

  const count = await model.countDocuments(query);

  if (count >= limit) {
    redirectToPricingWithUpgradeMessage(
      req,
      res,
      `Your current subscription allows only ${limit} ${entityLabel}. Please upgrade your subscription to add more.`
    );
    return { allowed: false };
  }

  return { allowed: true };
}

module.exports = {
  enforceEntityLimit,
};