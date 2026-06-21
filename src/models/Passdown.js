const mongoose = require("mongoose");

const passdownReadSchema = new mongoose.Schema(
  {
    guardId: String,
    guardName: String,
    readAt: Date,
  },
  { _id: false }
);

const passdownSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: true,
    },
    postSiteId: {
      type: String,
      required: true,
    },
    postSiteName: String,

    guardId: {
      type: String,
      required: true,
    },
    guardName: String,

    title: {
      type: String,
      default: "Passdown Note",
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },

    priority: {
      type: String,
      enum: ["Normal", "Urgent"],
      default: "Normal",
    },

    visibility: {
      type: String,
      enum: ["All Guards", "Next Shift"],
      default: "All Guards",
    },

    status: {
      type: String,
      enum: ["Open", "Closed"],
      default: "Open",
    },

    readBy: [passdownReadSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Passdown", passdownSchema);