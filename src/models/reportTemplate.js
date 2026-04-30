const mongoose = require("mongoose");

//
// 🔹 Individual Field Definition
//
const TemplateFieldSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true, // e.g. "Date of Incident"
    },

    keyName: {
      type: String,
      required: true, // e.g. "date_of_incident"
      lowercase: true,
      trim: true,
    },

    type: {
      type: String,
      required: true,
      enum: [
        "text",
        "textarea",
        "date",
        "dropdown",
        "radio",
        
        "number",
        "time",
        "checkbox",
      ],
    },

    required: {
      type: Boolean,
      default: false,
    },

    hint: {
      type: String,
      default: "",
    },

    placeholder: {
      type: String,
      default: "",
    },

    options: {
      type: [String], // used for dropdown/radio/checkbox
      default: [],
    },

    maxLength: {
      type: Number,
      default: null,
    },

    order: {
      type: Number,
      default: 0,
    },

    // 🔥 Future-proofing (very useful later)
    validation: {
      min: Number,
      max: Number,
      regex: String,
    },
  },
  { _id: false }
);

//
// 🔹 Main Report Template Schema
//
const ReportTemplateSchema = new mongoose.Schema(
  {
    companyID: {
      type: String,
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
    },

    category: {
      type: String,
      enum: ["incident", "standard", "log", "general", "nfc"],
      default: "general",
    },
    templateId: {
  type: String,
  default: "",
},

    active: {
      type: Boolean,
      default: true,
    },

    showFabMenu: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: String,
      default: "",
    },

    fields: {
      type: [TemplateFieldSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

//
// 🔹 Ensure unique template per company
//
ReportTemplateSchema.index(
  { companyID: 1, title: 1 },
  { unique: true }
);

//
// 🔹 Auto-generate keyName if not provided
//
ReportTemplateSchema.pre("validate", function (next) {
  if (this.fields && this.fields.length > 0) {
    this.fields.forEach((f) => {
      if (!f.keyName && f.label) {
        f.keyName = f.label
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_|_$/g, "");
      }
    });
  }
  next();
});

module.exports = mongoose.model("ReportTemplate", ReportTemplateSchema);