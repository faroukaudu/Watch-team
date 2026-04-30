const mongoose = require("mongoose");

const noteSchema = new mongoose.Schema(
  {
    companyID: {
      type: String,
      required: true,
      index: true,
    },

    postSiteID: {
      type: String,
      required: true,
      index: true,
    },

    postSiteName: {
      type: String,
      default: "",
    },

    guardID: {
      type: String,
      required: true,
      index: true,
    },

    guardName: {
      type: String,
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    note: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Note || mongoose.model("Note", noteSchema);