const mongoose = require("mongoose");

const postSiteTaskSchema = new mongoose.Schema({
  companyId: String,

  postSiteId: String,
  postSiteName: String,

  taskName: String,
  taskDescription: String,
  maxDuration: String,

  assignedGuards: [
    {
      guardId: String,
      guardName: String,
      guardEmail: String
    }
  ],

  taskType: {
    type: String,
    enum: ["One-Off", "Recurring"],
    default: "One-Off"
  },

  oneOff: {
    startDateTime: Date,
    dueDateTime: Date
  },

  recurring: {
    continuous: {
      type: Boolean,
      default: false
    },
    scheduledDays: [String],
    mode: {
      type: String,
      enum: ["Specific Time", "Repeat"],
      default: "Specific Time"
    },
    startTime: String,
    startingFrom: Date,
    repeatType: String,
    repeatEvery: Number,
    repeatEndType: String,
    repeatEndAfter: Number
  },

  subTasks: [
    {
      title: String
    }
  ],

  completions: [
    {
      guardId: String,
      completedDate: String,
      completedAt: Date,
      completedSubTasks: [Number],
      status: {
        type: String,
        enum: ["Pending", "Completed"],
        default: "Pending"
      }
    }
  ],

  status: {
    type: String,
    enum: ["Active", "Completed", "Inactive"],
    default: "Active"
  },

  createdById: String,
  createdByName: String

}, { timestamps: true });

module.exports = mongoose.model("PostSiteTask", postSiteTaskSchema);