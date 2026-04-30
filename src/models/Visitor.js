const mongoose = require("mongoose");

const attachmentSchema = {
  kind: String,
  publicId: String,
  secureUrl: String,
  resourceType: String,
  format: String,
  bytes: Number,
  originalName: String,
  uploadedAt: {
    type: Date,
    default: Date.now
  }
};

const visitorSchema = new mongoose.Schema({
  companyId: String,

  postSiteId: String,
  postSiteName: String,

  guardId: String,
  guardName: String,

  visitorName: String,
  sex: String,
  phoneNumber: String,
  email: String,
  purposeOfVisit: String,
  firstTimeVisiting: Boolean,

  visitDateTime: {
    type: Date,
    default: Date.now
  },

visitorFace: {
  type: Object,
  default: {}
},

visitorIdCard: {
  type: Object,
  default: {}
},

signature: {
  type: Object,
  default: {}
},

}, { timestamps: true });

module.exports = mongoose.model("Visitor", visitorSchema);