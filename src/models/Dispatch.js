const mongoose = require("mongoose");

const DispatchSchema = new mongoose.Schema({
  ticketId: { type: String, unique: true },

  companyId: String,

  clientId: String,
  clientName: String,

  postSiteId: String,
  postSiteName: String,

  guardId: String,
  guardName: String,
  callerName:String,

priority: { type: String, enum: ["Low", "Medium", "High"], default: "Low" },

callerType: { 
  type: String, 
  enum: ["Client", "Guard", "Tenant", "Other"], 
  default: "Other" 
},

  incidentLocation: String,
  incidentType: String,

  incidentDateTime: Date,

  incidentDetails: String,
  actionTaken: String,
  internalNotes: String,

  attachments: [String],

  status: { type: String, default: "Pending" }, // Pending / Accepted
  acceptedBy: String,
  acceptedAt: Date,

}, { timestamps: true });

module.exports = mongoose.model("Dispatch", DispatchSchema);