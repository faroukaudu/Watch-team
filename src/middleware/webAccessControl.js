const mongoose = require("mongoose");
const UserSubscription = require("../models/UserSubscription");
const companySchema = require("../../db/companyinfodb");
const Company = mongoose.models.Company || mongoose.model("Company", companySchema);

function isGuard(user) {
  return !!user && ["AmobileGuard", "MobileGuard", "Guard", "Guards"].includes(user.userType);
}

function isClient(user) {
  return !!user && user.userType === "Client";
}

function deny(req, res, message, redirectTo = "/activities") {
  req.session.accessNotice = message;
  if (req.xhr || String(req.headers.accept || "").includes("application/json")) {
    return res.status(403).json({ ok: false, message });
  }
  return res.redirect(redirectTo);
}

async function webAccessControl(req, res, next) {
  try {
    res.locals.accessNotice = req.session?.accessNotice || null;
    if (req.session) delete req.session.accessNotice;

    if (!req.user) return next();

    if (req.user.status === false || req.user.isBlocked === true) {
      req.logout(() => {});
      return deny(req, res, "Your account has been blocked. Please contact an administrator.", "/sign-in");
    }

    if (isGuard(req.user)) {
      req.logout(() => {});
      return deny(req, res, "Guards should log on from the mobile app.", "/sign-in");
    }

    if (req.user.userType !== "Platform Admin") {
      const companyId = String(req.user.assignedCompanyID || "");
      const company = companyId ? await Company.findById(companyId).select("isBlocked").lean() : null;
      if (company?.isBlocked === true) {
        return deny(req, res, "This company has been blocked by the Platform Administrator.", "/sign-in");
      }

      const subscription = await UserSubscription.findOne({
        companyId: String(req.user.assignedCompanyID || ""),
      }).sort({ createdAt: -1 }).lean();

      if (subscription?.isBlocked === true) {
        return deny(req, res, "This company subscription has been blocked by the Platform Administrator.", "/sign-in");
      }
    }

    if (!isClient(req.user)) return next();

    const path = req.path;
    const method = req.method.toUpperCase();

    const clientForbiddenPrefixes = [
      "/dashboard", "/new-client", "/client-edit", "/delete-client",
      "/pricing", "/select-payment", "/my-subscription", "/admin/subscriptions",
      "/billing", "/platform-admin", "/new-guards", "/add-guard", "/bo-user",
      "/new-bo-user", "/dar", "/api/dar"
    ];

    if (clientForbiddenPrefixes.some((prefix) => path === prefix || path.startsWith(prefix + "/"))) {
      const subscriptionRequest = ["/pricing", "/select-payment", "/my-subscription", "/admin/subscriptions", "/billing"].some(
        (prefix) => path === prefix || path.startsWith(prefix + "/")
      );
      const adminOnlyRequest =
        path === "/dar" ||
        path.startsWith("/dar/") ||
        path === "/api/dar" ||
        path.startsWith("/api/dar/") ||
        subscriptionRequest;

      return deny(
        req,
        res,
        adminOnlyRequest
          ? "Only meant for Admin."
          : "You do not have permission to open this page."
      );
    }

    // Clients may open operational pages, but cannot administer users or other companies.
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method) &&
        (path.startsWith("/update-client") || path.startsWith("/delete-client") ||
         path.startsWith("/create-client") || path.startsWith("/new-cli") ||
         path.startsWith("/new-bo-user") || path.startsWith("/create-bo-user"))) {
      return deny(req, res, "Clients have read-only access to user records.");
    }

    // Clients may view guards assigned to their post site but may not create, delete or globally reassign guards.
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method) &&
        (path.startsWith("/guard") || path.startsWith("/add-guard") || path.startsWith("/delete-guard"))) {
      return deny(req, res, "Clients can view assigned guards but cannot add, delete or globally reassign guards.");
    }

    return next();
  } catch (error) {
    console.error("webAccessControl error:", error);
    return res.status(500).send("Unable to verify web access.");
  }
}

module.exports = { webAccessControl, isGuard, isClient };
