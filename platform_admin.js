const myModule = require("./index.js");
const mongoose = require("mongoose");
const requirePlatformAdmin = require("./src/middleware/requirePlatformAdmin");
const UserSubscription = require("./src/models/UserSubscription");
const Report = require("./src/models/report");
const companyInfo = require("./db/companyinfodb.js");

const app = myModule.main;
const User = myModule.userDB;
const Company = mongoose.models.Company || mongoose.model("Company", companyInfo);

app.get("/platform-admin", requirePlatformAdmin, async (req, res) => {
  try {
    const companies = await Company.find({}).lean();
    const subscriptions = await UserSubscription.find({}).lean();
    const users = await User.find({}).lean();
    const reportCounts = await Report.aggregate([{ $group: { _id: "$companyID", count: { $sum: 1 } } }]);

    const subMap = Object.fromEntries(subscriptions.map(s => [String(s.companyId), s]));
    const reportMap = Object.fromEntries(reportCounts.map(r => [String(r._id), r.count]));
    const companyRows = companies.map(company => {
      const id = String(company._id);
      const companyUsers = users.filter(u => String(u.assignedCompanyID || "") === id);
      return {
        ...company,
        subscription: subMap[id] || null,
        planName: subMap[id]?.planName || "-",
        subscriptionStatus: subMap[id]?.subscriptionStatus || "none",
        isActive: !!subMap[id]?.isActive && !subMap[id]?.isBlocked,
        expiresAt: subMap[id]?.expiresAt || null,
        gateway: subMap[id]?.gateway || "-",
        clientsCount: companyUsers.filter(u => u.userType === "Client").length,
        guardsCount: companyUsers.filter(u => u.userType === "AmobileGuard").length,
        adminsCount: companyUsers.filter(u => u.userType === "Super Admin").length,
        reportsCount: reportMap[id] || 0,
      };
    });

    res.render("dashboard/platform-admin-dashboard", {
      userInfo: req.user,
      companies: companyRows,
      totals: {
        companies: companies.length,
        clients: users.filter(u => u.userType === "Client").length,
        guards: users.filter(u => u.userType === "AmobileGuard").length,
        activeSubscriptions: subscriptions.filter(s => s.isActive && !s.isBlocked).length,
        inactiveSubscriptions: subscriptions.filter(s => !s.isActive || s.isBlocked).length,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Unable to load platform administration.");
  }
});

app.get("/platform-admin/company/:companyId", requirePlatformAdmin, async (req, res) => {
  try {
    const company = await Company.findById(req.params.companyId).lean();
    if (!company) return res.status(404).send("Company not found");
    const subscription = await UserSubscription.findOne({ companyId: String(company._id) }).sort({ createdAt: -1 }).lean();
    const users = await User.find({ assignedCompanyID: String(company._id) }).lean();
    const reports = await Report.find({ companyID: String(company._id) }).sort({ createdAt: -1 }).limit(100).lean();
    res.render("dashboard/platform-admin-company-details", {
      userInfo: req.user, company, subscription, reports,
      clients: users.filter(u => u.userType === "Client"),
      guards: users.filter(u => u.userType === "AmobileGuard"),
      companyAdmins: users.filter(u => u.userType === "Super Admin"),
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Unable to load company details.");
  }
});

app.post("/platform-admin/company/:companyId/toggle-block", requirePlatformAdmin, async (req, res) => {
  const company = await Company.findById(req.params.companyId);
  if (!company) return res.status(404).json({ ok: false, message: "Company not found" });
  company.isBlocked = !company.isBlocked;
  company.blockedAt = company.isBlocked ? new Date() : null;
  await company.save();
  res.json({ ok: true, isBlocked: company.isBlocked });
});

app.post("/platform-admin/user/:userId/toggle-block", requirePlatformAdmin, async (req, res) => {
  const user = await User.findById(req.params.userId);
  if (!user) return res.status(404).json({ ok: false, message: "User not found" });
  user.isBlocked = !user.isBlocked;
  // user.status == true ? user.status=false : 
  user.blockedAt = user.isBlocked ? new Date() : null;
  await user.save();
  res.json({ ok: true, isBlocked: user.isBlocked });
});

app.post("/platform-admin/subscription/:subscriptionId/toggle-block", requirePlatformAdmin, async (req, res) => {
  const subscription = await UserSubscription.findById(req.params.subscriptionId);
  if (!subscription) return res.status(404).json({ ok: false, message: "Subscription not found" });
  subscription.isBlocked = !subscription.isBlocked;
  subscription.blockedAt = subscription.isBlocked ? new Date() : null;
  await subscription.save();
  res.json({ ok: true, isBlocked: subscription.isBlocked });
});

module.exports = app;
