function requirePlatformAdmin(req, res, next) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.redirect("/sign-in");
  }

  if (!req.user || req.user.userType !== "Platform Admin") {
    return res.status(403).send("Unauthorized");
  }

  return next();
}

module.exports = requirePlatformAdmin;