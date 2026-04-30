const mongoose = require("mongoose");

const timeOffRequestSchema = new mongoose.Schema({
  companyId: String,

  guardId: String,
  guardName: String,
  guardEmail: String,

  fromDate: String,
toDate: String,

  status: {
    type: String,
    enum: ["Pending", "Accepted", "Rejected"],
    default: "Pending"
  },

  requestDate: {
    type: Date,
    default: Date.now
  },

  reviewedById: String,
  reviewedByName: String,
  reviewedAt: Date

}, { timestamps: true });

module.exports = mongoose.model("TimeOffRequest", timeOffRequestSchema);