const mongoose = require("mongoose");

const shiftExchangeSchema = new mongoose.Schema({
  companyId: String,

  shiftTemplateId: String,
  shiftTitle: String,

  postSiteId: String,
  postSiteName: String,

  requestDate: {
    type: Date,
    default: Date.now
  },

  sentByGuardId: String,
  sentByGuardName: String,

  receivedByGuardId: String,
  receivedByGuardName: String,

  status: {
    type: String,
    enum: ["Pending", "Accepted", "Rejected"],
    default: "Pending"
  },

  acceptedByReceiverOnShiftDetail: {
  type: Boolean,
  default: false
},

  responseDate: Date

}, { timestamps: true });

module.exports = mongoose.model("ShiftExchange", shiftExchangeSchema);