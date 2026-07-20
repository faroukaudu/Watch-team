const mongoose = require("mongoose");

const UserSubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    companyId: {
      type: String,
      default: "",
      index: true,
    },

    username: {
      type: String,
      default: "",
    },

    email: {
      type: String,
      default: "",
      index: true,
    },

    gateway: {
      type: String,
      enum: ["stripe", "paypal"],
      required: true,
      index: true,
    },

    planCode: {
      type: String,
      enum: [
        "essential_monthly",
        "advanced_monthly",
        "professional_monthly",
        "essential_yearly",
        "advanced_yearly",
        "professional_yearly",
      ],
      required: true,
      index: true,
    },

    planName: {
      type: String,
      enum: ["Basic", "Essential", "Advanced", "Professional"],
      required: true,
    },

    billingCycle: {
      type: String,
      enum: ["monthly", "yearly"],
      required: true,
    },

    subscriptionStatus: {
      type: String,
      enum: [
        "pending",
        "trialing",
        "active",
        "past_due",
        "paused",
        "canceled",
        "expired",
        "unpaid",
        "incomplete",
        "incomplete_expired",
      ],
      default: "pending",
      index: true,
    },

    isActive: {
      type: Boolean,
      default: false,
      index: true,
    },

    isBlocked: { type: Boolean, default: false, index: true },
    blockedAt: { type: Date, default: null },
    blockedReason: { type: String, default: "" },
    commitmentMonths: { type: Number, default: 1 },
    renewalCount: { type: Number, default: 0 },
    lastSuccessfulPaymentAt: { type: Date, default: null },

    startsAt: {
      type: Date,
      default: null,
    },

    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },

    canceledAt: {
      type: Date,
      default: null,
    },

    stripeCustomerId: {
      type: String,
      default: "",
      index: true,
    },

    stripeSubscriptionId: {
      type: String,
      default: "",
      index: true,
    },

    stripeCheckoutSessionId: {
      type: String,
      default: "",
      index: true,
    },

    paypalSubscriptionId: {
      type: String,
      default: "",
      index: true,
    },

    paypalPlanId: {
      type: String,
      default: "",
    },

    amount: {
      type: Number,
      default: 0,
    },

    currency: {
      type: String,
      default: "USD",
    },

    features: {
      dashboard: { type: Boolean, default: false },
      activity: { type: Boolean, default: false },
      clients: { type: Boolean, default: false },
      securityTeam: { type: Boolean, default: false },
      timeClock: { type: Boolean, default: false },
      reportingDays: { type: Number, default: 0 },
      gpsTrackingDays: { type: Number, default: 0 },
      geofenceDays: { type: Number, default: 0 },
      messenger: { type: Boolean, default: false },
      siteTourDays: { type: Number, default: 0 },
      taskDays: { type: Number, default: 0 },
      checklistDays: { type: Number, default: 0 },
      supportLevel: { type: String, default: "none" },
      maxSuperAdmins: { type: Number, default: 1 },
      maxClients: { type: Number, default: 3 },
      maxSecurityGuards: { type: Number, default: 2 },
      maxPostSites: { type: Number, default: 3 },
      maxBackOfficeUsers: { type: Number, default: 2 },
    },

    rawGatewayPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

UserSubscriptionSchema.index(
  { userId: 1, companyId: 1 },
  { unique: true }
);

module.exports = mongoose.model("UserSubscription", UserSubscriptionSchema);