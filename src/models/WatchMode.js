const mongoose = require("mongoose");

const watchModeSchema = new mongoose.Schema(
  {
    companyId: { type: String, required: true },
    guardId: { type: String, required: true },
    guardName: String,

    videoUrl: { type: String, required: true },
    publicId: String,
    duration: Number,

    note: String,
    status: {
      type: String,
      enum: ["Submitted", "Reviewed"],
      default: "Submitted",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("WatchMode", watchModeSchema);