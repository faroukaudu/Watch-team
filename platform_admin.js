const myModule = require("./index.js");
const mongoose = require("mongoose");

const requirePlatformAdmin = require("./src/middleware/requirePlatformAdmin");
const UserSubscription = require("./src/models/UserSubscription");

const app = myModule.main;
const User = myModule.userDB;

const companyInfo = require(__dirname + "/db/companyinfodb.js");
const Company = mongoose.model("Company", companyInfo);

app.get("/platform-admin", requirePlatformAdmin, async (req, res) => {
    console.log("HIT /platform-admin/dashboard");
  try {
    const companies = await Company.find({}).lean();
    const subscriptions = await UserSubscription.find({}).lean();

    const subscriptionMap = {};
    subscriptions.forEach((sub) => {
      subscriptionMap[String(sub.companyId)] = sub;
    });

    const companyIds = companies.map((c) => String(c._id));

    const users = await User.find({
      assignedCompanyID: { $in: companyIds }
    }).lean();

    const countsMap = {};
    companyIds.forEach((id) => {
      countsMap[id] = {
        clients: 0,
        guards: 0,
        admins: 0,
      };
    });

    users.forEach((user) => {
      const compId = String(user.assignedCompanyID || "");
      if (!countsMap[compId]) {
        countsMap[compId] = { clients: 0, guards: 0, admins: 0 };
      }

      if (user.userType === "Client") countsMap[compId].clients += 1;
      if (user.userType === "AmobileGuard") countsMap[compId].guards += 1;
      if (user.userType === "Super Admin") countsMap[compId].admins += 1;
    });

    const companyRows = companies.map((company) => {
      const companyId = String(company._id);
      const sub = subscriptionMap[companyId] || null;
      const counts = countsMap[companyId] || { clients: 0, guards: 0, admins: 0 };

      return {
        _id: companyId,
        companyName: company.companyName || company.name || "Unnamed Company",
        companyEmail: company.companyEmail || company.email || "-",
        clientsCount: counts.clients,
        guardsCount: counts.guards,
        adminsCount: counts.admins,
        planName: sub?.planName || "-",
        subscriptionStatus: sub?.subscriptionStatus || "none",
        isActive: sub?.isActive || false,
        expiresAt: sub?.expiresAt || null,
        gateway: sub?.gateway || "-",
      };
    });

    const totals = {
      companies: companies.length,
      clients: companyRows.reduce((sum, row) => sum + row.clientsCount, 0),
      guards: companyRows.reduce((sum, row) => sum + row.guardsCount, 0),
      activeSubscriptions: companyRows.filter((row) => row.isActive).length,
      inactiveSubscriptions: companyRows.filter((row) => !row.isActive).length,
    };

    return res.render("dashboard/platform-admin-dashboard", {
      userInfo: req.user,
      totals,
      companies: companyRows,
    });
  } catch (err) {
    console.error("Platform admin dashboard error:", err);
    return res.status(500).send("Unable to load platform admin dashboard.");
  }
});

app.get("/platform-admin/company/:companyId", requirePlatformAdmin, async (req, res) => {
    console.log("<><><><><><><>><><><><><><><, you are !!!!!!")
  try {
    const { companyId } = req.params;
    

    const company = await Company.findById(companyId).lean();
    if (!company) {
      return res.status(404).send("Company not found");
    }

    const subscription = await UserSubscription.findOne({
      companyId: String(companyId),
    }).lean();

    const clients = await User.find({
      assignedCompanyID: String(companyId),
      userType: "Client",
    }).lean();

    const guards = await User.find({
      assignedCompanyID: String(companyId),
      userType: "AmobileGuard",
    }).lean();

    const companyAdmins = await User.find({
      assignedCompanyID: String(companyId),
      userType: "Super Admin",
    }).lean();

    return res.render("dashboard/platform-admin-company-details", {
      userInfo: req.user,
      company,
      subscription,
      clients,
      guards,
      companyAdmins,
    });
  } catch (err) {
    console.error("Platform admin company details error:", err);
    return res.status(500).send("Unable to load company details.");
  }
});

app.get("/monkey",(req,res)=>{
    res.send("close up");
})


app.get("/monkey/luffy/:companyId", async (req,res)=>{

    // res.send(req.params.companyId);
     try {
    const { companyId } = req.params;
    

    const company = await Company.findById(companyId).lean();
    if (!company) {
      return res.status(404).send("Company not found");
    }

    const subscription = await UserSubscription.findOne({
      companyId: String(companyId),
    }).lean();

    const clients = await User.find({
      assignedCompanyID: String(companyId),
      userType: "Client",
    }).lean();

    const guards = await User.find({
      assignedCompanyID: String(companyId),
      userType: "AmobileGuard",
    }).lean();

    const companyAdmins = await User.find({
      assignedCompanyID: String(companyId),
      userType: "Super Admin",
    }).lean();
    res.send(companyAdmins,);

    // return res.render("dashboard/platform-admin-company-details", {
    //   userInfo: req.user,
    //   company,
    //   subscription,
    //   clients,
    //   guards,
    //   companyAdmins,
    // });
  } catch (err) {
    console.error("Platform admin company details error:", err);
    return res.status(500).send("Unable to load company details.");
  }
})


module.exports = app;