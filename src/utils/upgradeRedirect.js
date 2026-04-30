function redirectToPricingWithUpgradeMessage(req, res, message) {
  req.session.upgradeMessage = message;
  return res.redirect("/pricing");
}

module.exports = {
  redirectToPricingWithUpgradeMessage,
};