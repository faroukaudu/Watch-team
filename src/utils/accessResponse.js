function setAccessModal(req, options = {}) {
  if (!req.session) return;

  req.session.accessModal = {
    type: options.type || "admin-only",
    title: options.title || "Access Restricted",
    message: options.message || "You do not have permission to view this page.",
    confirmText: options.confirmText || "Okay",
    confirmUrl: options.confirmUrl || null,
    cancelText: options.cancelText || null,
  };
}

function denyClientSupport(req, res, featureName = "this feature") {
  setAccessModal(req, {
    type: "admin-only",
    title: "Access Restricted",
    message: `${featureName} is not available to Client accounts. Please contact Support.`,
    confirmText: "Okay",
  });

  return res.redirect("/activities");
}

function requirePlanUpgrade(req, res, featureName = "this feature") {
  setAccessModal(req, {
    type: "upgrade",
    title: "Upgrade Required",
    message: `Your current plan does not include ${featureName}. Upgrade to Advanced or Professional to continue.`,
    confirmText: "Upgrade Plan",
    confirmUrl: "/pricing",
    cancelText: "Cancel",
  });

  return res.redirect("/activities");
}

module.exports = {
  setAccessModal,
  denyClientSupport,
  requirePlanUpgrade,
};
