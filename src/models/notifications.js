const Notification = require("../models/Notification");

function requireAuth(req, res, next) {
  if (!req.isAuthenticated || !req.isAuthenticated()) return res.redirect("/sign-in");
  next();
}

module.exports = function registerNotificationRoutes(app) {
  app.get("/notifications", requireAuth, async (req, res) => {
    const notifications = await Notification.find({ recipientUserId: req.user._id })
      .sort({ createdAt: -1 }).limit(200).lean();
    return res.render("dashboard/notifications", { userInfo: req.user, notifications });
  });

  app.get("/api/notifications", requireAuth, async (req, res) => {
    const notifications = await Notification.find({ recipientUserId: req.user._id })
      .sort({ createdAt: -1 }).limit(50).lean();
    const unread = await Notification.countDocuments({ recipientUserId: req.user._id, isRead: false });
    res.json({ success: true, notifications, unread });
  });

  app.get("/notifications/:id/open", requireAuth, async (req, res) => {
    const notification = await Notification.findOne({ _id: req.params.id, recipientUserId: req.user._id });
    if (!notification) return res.redirect("/notifications");
    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();
    const target = String(notification.targetUrl || "/notifications");
    return res.redirect(target.startsWith("/") && !target.startsWith("//") ? target : "/notifications");
  });

  app.post("/api/notifications/:id/read", requireAuth, async (req, res) => {
    await Notification.updateOne({ _id: req.params.id, recipientUserId: req.user._id }, { $set: { isRead: true, readAt: new Date() } });
    const unread = await Notification.countDocuments({ recipientUserId: req.user._id, isRead: false });
    res.json({ success: true, unread });
  });

  app.post("/api/notifications/mark-all-read", requireAuth, async (req, res) => {
    await Notification.updateMany({ recipientUserId: req.user._id, isRead: false }, { $set: { isRead: true, readAt: new Date() } });
    res.json({ success: true, unread: 0 });
  });
};
