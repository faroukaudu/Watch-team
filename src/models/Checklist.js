const mongoose = require("mongoose");

const checklistSchema = new mongoose.Schema({
  companyId: String,

  postSiteId: String,
  postSiteName: String,

  name: String,
  description: String,

  addedById: String,
  addedByName: String,
  addedByUserType: String,

  assignedGuards: [
    {
      guardId: String,
      guardName: String,
      guardEmail: String
    }
  ],

  items: [
    {
      text: String
    }
  ],

  progress: [
    {
      guardId: String,
      checkedItems: [Number],
      completed: {
        type: Boolean,
        default: false
      },
      completedAt: Date,
      updatedAt: {
        type: Date,
        default: Date.now
      }
    }
  ]

}, { timestamps: true });

module.exports = mongoose.model("Checklist", checklistSchema);