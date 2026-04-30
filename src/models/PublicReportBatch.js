const mongoose = require("mongoose");

const publicReportBatchSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true, index: true },
  reportIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Report", required: true }],
  clientEmail: { type: String, default: null },
  title: { type: String, default: "Reports" },
  expiresAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model("PublicReportBatch", publicReportBatchSchema);