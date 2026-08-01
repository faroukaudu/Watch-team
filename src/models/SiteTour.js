const mongoose = require("mongoose");

const siteTourCheckpointSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: String,
    qrCodeValue: {
      type: String,
      required: true,
    },
    nfcTagValue: {
      type: String,
      default: "",
    },
    nfcWritten: {
      type: Boolean,
      default: false,
    },
    nfcWrittenAt: Date,
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { _id: true }
);

const siteTourProgressSchema = new mongoose.Schema(
  {
    dateKey: {
      type: String,
      default: "",
      index: true,
    },
    guardId: String,
    guardName: String,
    startedAt: Date,
    completedAt: Date,
    status: {
      type: String,
      enum: ["Not Started", "In Progress", "Completed"],
      default: "Not Started",
    },
    checkpointSnapshot: [
      {
        checkpointId: String,
        checkpointName: String,
        order: Number,
      },
    ],
    scannedCheckpoints: [
      {
        checkpointId: String,
        checkpointName: String,
        scannedAt: Date,
        qrCodeValue: String,
        nfcTagValue: String,
        scanType: {
          type: String,
          enum: ["QR", "NFC"],
          default: "QR",
        },
        latitude: String,
        longitude: String,
      },
    ],
  },
  { _id: true }
);

const siteTourSchema = new mongoose.Schema(
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

    tourName: {
      type: String,
      required: true,
      trim: true,
    },
    description: String,

    durationKey: {
      type: String,
      enum: ["1_week", "1_month", "3_months", "6_months", "1_year"],
      default: "1_year",
    },
    scheduleStartDate: Date,
    scheduleEndDate: Date,

    createdById: String,
    createdByName: String,
    createdByUserType: String,

    checkpoints: [siteTourCheckpointSchema],
    progress: [siteTourProgressSchema],

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SiteTour", siteTourSchema);
