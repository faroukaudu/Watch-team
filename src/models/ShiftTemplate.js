const mongoose = require("mongoose");

const shiftTemplateSchema = new mongoose.Schema({
  companyId: String,

  shiftTitle: String,

  startTime: String,
  endTime: String,

  repeatDays: [String],
  repeatFor: String,

  postSiteId: String,
  postSiteName: String,

  guards: [
    {
      guardId: String,
      guardName: String,
      guardEmail: String
    }
  ],

  breaks: [String],

  note: String,

  createdById: String,
  createdByName: String,
  createdByUserType: String,

  status: {
    type: String,
    default: "Active"
  },
  selectedGuards: [
  {
    guardId: String,
    guardName: String,
    selectedAt: Date
  }
],

}, { timestamps: true });

module.exports = mongoose.model("ShiftTemplate", shiftTemplateSchema);