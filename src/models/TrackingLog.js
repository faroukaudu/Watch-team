const mongoose = require("mongoose");

const trackingLogSchema = new mongoose.Schema(
  {
    companyId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    userName: { type: String, default: "User" },
    userType: { type: String, default: "User" },
    source: {
      type: String,
      enum: ["guard", "web"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["online", "offline"],
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      enum: ["checkin", "location", "checkout", "web-online", "web-location", "web-offline"],
      required: true,
    },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    accuracy: { type: Number, default: null },
    speed: { type: Number, default: null },
    heading: { type: Number, default: null },
    locationLabel: { type: String, default: "" },
    recordedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

trackingLogSchema.index({ companyId: 1, recordedAt: -1 });
trackingLogSchema.index({ companyId: 1, userId: 1, recordedAt: -1 });

module.exports =
  mongoose.models.TrackingLog || mongoose.model("TrackingLog", trackingLogSchema);
