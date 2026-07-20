const Notification = require("../models/Notification");

module.exports = async function attachNotifications(req, res, next) {
  res.locals.headerNotifications = [];
  res.locals.unreadNotificationCount = 0;
  if (!req.user || !req.user._id) return next();
  try {
    const query = { recipientUserId: req.user._id };
    const [notifications, unread] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).limit(5).lean(),
      Notification.countDocuments({ ...query, isRead: false }),
    ]);
    res.locals.headerNotifications = notifications;
    res.locals.unreadNotificationCount = unread;
  } catch (error) {
    console.error("attachNotifications:", error.message);
  }
  next();
};
