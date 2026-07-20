const mongoose = require("mongoose");
const companyInfo = require("../../db/companyinfodb.js");
const userSchema = require("../../db/userdb.js");

const Company = mongoose.models.Company || mongoose.model("Company", companyInfo);
const User = mongoose.models.User || mongoose.model("User", userSchema);

function isClientUser(user) {
  return !!user && user.userType === "Client";
}

function isGuardUser(user) {
  return !!user && ["AmobileGuard", "MobileGuard", "Guard", "Guards"].includes(user.userType);
}

function normalizeSiteValue(value) {
  return String(value || "").trim().toLowerCase();
}

function getSiteIdentity(site) {
  if (!site) return "";

  const siteName = normalizeSiteValue(site.siteName);
  const address = normalizeSiteValue(site.address);

  // The current schema does not contain a shared post-site group ID.
  // Therefore, site name + address is used to identify the same physical site.
  return `${siteName}||${address}`;
}

function getAssignedPostSitesFromCompany(company, user) {
  if (!company || !user || !Array.isArray(company.postSite)) return [];

  const userId = String(user._id || user.id || "").trim();
  if (!userId) return [];

  // First locate post-site records directly assigned to the logged-in Client.
  const directlyAssignedSites = company.postSite.filter(
    (site) => String(site.clientID || "").trim() === userId
  );

  if (!directlyAssignedSites.length) return [];

  // Multiple Clients may share one physical post site. In the current schema,
  // each Client may have a separate postSite subdocument, so include every
  // post-site record with the same site name and address.
  const assignedSiteIdentities = new Set(
    directlyAssignedSites
      .map(getSiteIdentity)
      .filter(Boolean)
  );

  return company.postSite.filter((site) =>
    assignedSiteIdentities.has(getSiteIdentity(site))
  );
}

function getAssignedPostSiteFromCompany(company, user) {
  return getAssignedPostSitesFromCompany(company, user)[0] || null;
}

async function getClientScope(user) {
  const empty = {
    company: null,
    assignedPostSite: null,
    assignedPostSites: [],
    assignedPostSiteId: "",
    assignedPostSiteIds: [],
    allowedGuardIds: [],
    allowedClientIds: [],
  };

  if (!user || !user.assignedCompanyID) return empty;

  const company = await Company.findById(user.assignedCompanyID);
  if (!company) return empty;

  const assignedPostSites = getAssignedPostSitesFromCompany(company, user);
  const assignedPostSiteIds = assignedPostSites.map((site) => String(site._id));
  const assignedPostSite = assignedPostSites[0] || null;

  if (!isClientUser(user)) {
    return {
      company,
      assignedPostSite,
      assignedPostSites,
      assignedPostSiteId: assignedPostSite ? String(assignedPostSite._id) : "",
      assignedPostSiteIds,
      allowedGuardIds: [],
      allowedClientIds: [],
    };
  }

  const guards = assignedPostSiteIds.length
    ? await User.find({
        assignedCompanyID: user.assignedCompanyID,
        userType: "AmobileGuard",
        guardPostSite: { $elemMatch: { postSiteID: { $in: assignedPostSiteIds } } },
      }).select("_id")
    : [];

  // Include every valid Client ID attached to the same physical post site.
  // Empty strings are removed before the IDs are used in MongoDB ObjectId queries.
  const allowedClientIds = [
    ...new Set(
      assignedPostSites
        .map((site) => String(site.clientID || "").trim())
        .filter(Boolean)
    ),
  ];

  return {
    company,
    assignedPostSite,
    assignedPostSites,
    assignedPostSiteId: assignedPostSite ? String(assignedPostSite._id) : "",
    assignedPostSiteIds,
    allowedGuardIds: guards.map((guard) => String(guard._id)),
    allowedClientIds,
  };
}

module.exports = {
  isClientUser,
  isGuardUser,
  getAssignedPostSiteFromCompany,
  getAssignedPostSitesFromCompany,
  getClientScope,
};
