function isSubscriptionActive(subscription) {
  if (!subscription) return false;
  if (!subscription.isActive) return false;

  const activeStatuses = ["active", "trialing"];
  if (!activeStatuses.includes(subscription.subscriptionStatus)) return false;

  if (subscription.expiresAt && new Date(subscription.expiresAt) < new Date()) {
    return false;
  }

  return true;
}

function hasFeature(subscription, featureName) {
  if (!isSubscriptionActive(subscription)) return false;
  return Boolean(subscription.features && subscription.features[featureName]);
}

function getNumericFeature(subscription, featureName) {
  if (!isSubscriptionActive(subscription)) return 0;
  return Number(subscription.features?.[featureName] || 0);
}

module.exports = {
  isSubscriptionActive,
  hasFeature,
  getNumericFeature,
};