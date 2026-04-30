const mongoose = require("mongoose");

const AttachmentSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ["signature", "image", "audio", "video"],
      required: true,
    },
    publicId: { type: String, required: true },
    secureUrl: { type: String, required: true },
    resourceType: { type: String, required: true }, // "image" or "video"
    format: { type: String },
    bytes: { type: Number },
    duration: { type: Number }, // audio/video
  },
  { _id: false }
);

const ReportSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },

    templateId: {
      type: String,
      default: "",
    },

    category: {
      type: String,
      enum: ["general", "incident", "standard", "log", "nfc"],
      default: "general",
    },

    fields: { type: Object, default: {} },

    attachments: { type: [AttachmentSchema], default: [] },

    userId: { type: String, default: "" },
    fullname: { type: String, default: "" },
    companyID: { type: String, default: "" },

    status: { type: Boolean, default: false },

    publicShareToken: { type: String, default: null, index: true },
    publicShareEnabled: { type: Boolean, default: false },
    publicShareExpiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Report", ReportSchema);