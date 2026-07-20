const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const userSchema = require("../../db/userdb");
const companySchema = require("../../db/companyinfodb");
const { getAssignedPostSitesFromCompany } = require("../utils/clientScope");

const User = mongoose.models.User || mongoose.model("User", userSchema);
const Company = mongoose.models.Company || mongoose.model("Company", companySchema);

function safe(value) { return String(value || "").trim(); }
function isPlatformAdmin(user) { return safe(user && user.userType) === "Platform Admin"; }
function isClient(user) { return safe(user && user.userType) === "Client"; }
function isAdmin(user) { return safe(user && user.userType) === "Super Admin"; }

function getIo(app) {
  return app && app.get && app.get("socketio");
}

async function emitToRecipient(app, recipientUserId, notification) {
  const io = getIo(app);
  if (!io) return;
  const unreadCount = await Notification.countDocuments({ recipientUserId, isRead: false });
  io.to(`user:${recipientUserId}`).emit("notification:new", {
    notification,
    unreadCount,
  });
}

async function createForUsers(app, users, data) {
  const unique = new Map();
  for (const user of users || []) {
    if (!user || !user._id) continue;
    unique.set(String(user._id), user);
  }
  const created = [];
  for (const user of unique.values()) {
    const doc = await Notification.create({
      companyId: safe(data.companyId || user.assignedCompanyID),
      recipientUserId: user._id,
      recipientRole: safe(user.userType),
      type: data.type,
      title: data.title,
      message: data.message || "",
      targetUrl: data.targetUrl || "/notifications",
      referenceId: safe(data.referenceId),
      postSiteId: safe(data.postSiteId),
      actorUserId: safe(data.actorUserId),
      actorName: safe(data.actorName),
    });
    created.push(doc);
    await emitToRecipient(app, String(user._id), doc.toObject());
  }
  return created;
}

async function companyOperationalRecipients(companyId, postSiteId = "") {
  const users = await User.find({ assignedCompanyID: safe(companyId), status: { $ne: false } })
    .select("_id userType assignedCompanyID fullname guardPostSite");
  const admins = users.filter(isAdmin);
  if (!postSiteId) return admins;

  const company = await Company.findById(companyId);
  if (!company) return admins;

  const clients = users.filter(isClient).filter((client) => {
    const sites = getAssignedPostSitesFromCompany(company, client);
    return sites.some((site) => String(site._id) === String(postSiteId));
  });
  return [...admins, ...clients];
}

async function notifyChatMessage(app, { companyId, senderId, receiverIds, senderName, chatId, messageId }) {
  const receivers = await User.find({ _id: { $in: receiverIds }, assignedCompanyID: safe(companyId) })
    .select("_id userType assignedCompanyID");
  return createForUsers(app, receivers.filter((u) => !isPlatformAdmin(u)), {
    companyId,
    type: "new_message",
    title: "New Message",
    message: `${senderName || "A user"} sent you a new message.`,
    targetUrl: `/chat?chatId=${encodeURIComponent(chatId)}&userId=${encodeURIComponent(senderId)}`,
    referenceId: messageId,
    actorUserId: senderId,
    actorName: senderName,
  });
}

async function notifyOperational(app, data) {
  const recipients = await companyOperationalRecipients(data.companyId, data.postSiteId);
  return createForUsers(app, recipients.filter((u) => !isPlatformAdmin(u)), data);
}

async function notifyPlatformSubscription(app, data) {
  const platformAdmins = await User.find({ userType: "Platform Admin", status: { $ne: false } })
    .select("_id userType assignedCompanyID");
  return createForUsers(app, platformAdmins, {
    companyId: data.companyId || "",
    type: "subscription",
    title: data.title || "Subscription Update",
    message: data.message || "A subscription event occurred.",
    targetUrl: data.targetUrl || "/admin/subscriptions",
    referenceId: data.referenceId || "",
  });
}

module.exports = { createForUsers, notifyChatMessage, notifyOperational, notifyPlatformSubscription };
