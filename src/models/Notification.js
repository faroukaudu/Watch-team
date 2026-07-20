const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema({
  companyId: { type: String, default: "", index: true },
  recipientUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  recipientRole: { type: String, default: "" },
  type: { type: String, required: true, index: true },
  title: { type: String, required: true },
  message: { type: String, default: "" },
  targetUrl: { type: String, default: "/notifications" },
  referenceId: { type: String, default: "", index: true },
  postSiteId: { type: String, default: "", index: true },
  actorUserId: { type: String, default: "" },
  actorName: { type: String, default: "" },
  isRead: { type: Boolean, default: false, index: true },
  readAt: { type: Date, default: null },
}, { timestamps: true });

NotificationSchema.index({ recipientUserId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ companyId: 1, postSiteId: 1, createdAt: -1 });

module.exports = mongoose.models.Notification || mongoose.model("Notification", NotificationSchema);
