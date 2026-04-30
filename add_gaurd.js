const mongoose = require("mongoose");
const companyInfo = require(__dirname + "/db/companyinfodb.js");
const Company = mongoose.model("Company", companyInfo);

async function addingGuardstoPostSite(guardInfo, companyID) {
  const guardDetails = {
    name: guardInfo.fullname,
    email: guardInfo.username,
    mobile: guardInfo.phone,
    statusIsActive: true,
    assignClient: guardInfo.guardClients || [],
    assignPost: guardInfo.guardPostSite || [],
  };

  const mainCompany = await Company.findById(companyID);
  if (!mainCompany) throw new Error("Company not found");

  mainCompany.guards.push(guardDetails);
  await mainCompany.save();
}

module.exports = addingGuardstoPostSite;
