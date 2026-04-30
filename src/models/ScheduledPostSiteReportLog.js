const mongoose = require("mongoose");

const ScheduledPostSiteReportLogSchema = new mongoose.Schema(
  {
    scheduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ScheduledPostSiteReport",
      required: true,
      index: true,
    },

    companyId: { type: String, required: true, index: true },
    postSiteId: { type: String, required: true, index: true },

    clientName: { type: String, default: "" },
    clientEmail: { type: String, required: true },

    frequency: {
      type: String,
      enum: ["5min", "10min","Daily", "Weekly", "Monthly"],
      required: true,
    },

    reportTitle: { type: String, default: "" },

    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },

    reportCount: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["success", "failed", "skipped_no_reports"],
      required: true,
    },

    errorMessage: { type: String, default: "" },
    batchToken: { type: String, default: "" },
    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "ScheduledPostSiteReportLog",
  ScheduledPostSiteReportLogSchema
);