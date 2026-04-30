const mongoose = require("mongoose");

const CalendarEventSchema = new mongoose.Schema(
  {
    companyId: { type: String, required: true },
    userId: { type: String, required: true },

    title: { type: String, required: true },
    start: { type: Date, required: true },
    end: { type: Date, default: null },
    allDay: { type: Boolean, default: false },
    className: { type: String, default: "bg-primary-transparent" },

    // ✅ SINGLE values (not array)
    assignedTo: { type: String, default: "" },   // guardId
    postSiteId: { type: String, default: "" },   // postSiteId
    frequency: { type: String, default: "" },
    description: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.CalendarEvent ||
  mongoose.model("CalendarEvent", CalendarEventSchema);

