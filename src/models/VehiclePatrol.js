const mongoose = require("mongoose");

const patrolSessionSchema = new mongoose.Schema({
  guardId: { type: String, required: true },
  guardName: { type: String, default: "Guard" },
  status: {
    type: String,
    enum: ["Active", "Paused", "Completed", "Cancelled"],
    default: "Active",
  },
  startedAt: { type: Date, default: Date.now },
  pausedAt: Date,
  totalPausedSeconds: { type: Number, default: 0 },
  completedAt: Date,
  durationSeconds: { type: Number, default: 0 },
  counter: { type: Number, default: 0 },
  notes: { type: String, default: "" },
}, { timestamps: true });

const vehiclePatrolSchema = new mongoose.Schema({
  companyId: { type: String, required: true, index: true },
  postSiteId: { type: String, required: true, index: true },
  postSiteName: { type: String, default: "" },
  patrolName: { type: String, required: true, trim: true },
  vehicleLabel: { type: String, default: "Patrol Vehicle" },
  instructions: { type: String, default: "" },
  counterLabel: { type: String, default: "Patrol rounds" },
  targetCount: { type: Number, default: 1, min: 1 },
  expectedDurationMinutes: { type: Number, default: 30, min: 1 },
  isActive: { type: Boolean, default: true },
  createdById: String,
  createdByName: String,
  sessions: [patrolSessionSchema],
}, { timestamps: true });

module.exports = mongoose.model("VehiclePatrol", vehiclePatrolSchema);
