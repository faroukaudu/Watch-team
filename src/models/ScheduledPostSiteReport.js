const mongoose = require("mongoose");

const ScheduledPostSiteReportSchema = new mongoose.Schema(
  {
    companyId: { type: String, required: true, index: true },
    postSiteId: { type: String, required: true, index: true },

    clientName: { type: String, default: "" },
    clientEmail: { type: String, required: true, index: true },

    reportTitle: { type: String, default: "Scheduled Site Report" },

    frequency: {
      type: String,
      enum: ["5min", "10min","Daily", "Weekly", "Monthly"],
      required: true,
    },

    // remove 5 and 10min after TESTING

    startDate: { type: Date, required: true },
    nextSendAt: { type: Date, required: true, index: true },
    lastSentAt: { type: Date, default: null },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ScheduledPostSiteReportSchema.index(
  { companyId: 1, postSiteId: 1, clientEmail: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "ScheduledPostSiteReport",
  ScheduledPostSiteReportSchema
);