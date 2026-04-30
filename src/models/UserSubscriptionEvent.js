const mongoose = require("mongoose");

const UserSubscriptionEventSchema = new mongoose.Schema(
  {
    userSubscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserSubscription",
      required: false,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },

    companyId: {
      type: String,
      default: "",
      index: true,
    },

    gateway: {
      type: String,
      enum: ["stripe", "paypal"],
      required: true,
    },

    eventType: {
      type: String,
      required: true,
      index: true,
    },

    externalCustomerId: {
      type: String,
      default: "",
    },

    externalSubscriptionId: {
      type: String,
      default: "",
      index: true,
    },

    statusAfterEvent: {
      type: String,
      default: "",
    },

    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserSubscriptionEvent", UserSubscriptionEventSchema);