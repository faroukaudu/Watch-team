const mongoose = require('mongoose');
const companyInfo = require('../../db/companyinfodb.js');
const userSchema = require('../../db/userdb.js');

const Company = mongoose.models.Company || mongoose.model('Company', companyInfo);
const User = mongoose.models.User || mongoose.model('User', userSchema);

function isClientUser(user) {
  return !!user && user.userType === 'Client';
}

function isGuardUser(user) {
  return !!user && (user.userType === 'AmobileGuard' || user.userType === 'Guards');
}

function getAssignedPostSiteFromCompany(company, user) {
  if (!company || !user || !Array.isArray(company.postSite)) return null;
  const userId = String(user._id || user.id || '');
  return company.postSite.find((site) => String(site.clientID || '') === userId) || null;
}

async function getClientScope(user) {
  if (!user || !user.assignedCompanyID) {
    return { company: null, assignedPostSite: null, assignedPostSiteId: '', allowedGuardIds: [] };
  }

  const company = await Company.findById(user.assignedCompanyID);
  const assignedPostSite = getAssignedPostSiteFromCompany(company, user);
  const assignedPostSiteId = assignedPostSite ? String(assignedPostSite._id) : '';

  let allowedGuardIds = [];
  if (isClientUser(user) && assignedPostSiteId) {
    const guards = await User.find({
      assignedCompanyID: user.assignedCompanyID,
      userType: 'AmobileGuard',
      guardPostSite: { $elemMatch: { postSiteID: assignedPostSiteId } }
    }).select('_id');
    allowedGuardIds = guards.map((guard) => String(guard._id));
  }

  return { company, assignedPostSite, assignedPostSiteId, allowedGuardIds };
}

module.exports = {
  isClientUser,
  isGuardUser,
  getAssignedPostSiteFromCompany,
  getClientScope,
};
