const mongoose = require('mongoose');

const parkingRecordSchema = new mongoose.Schema({
  type: { type: String, enum: ['CheckIn', 'Violation'], default: 'CheckIn' },
  plateNumber: { type: String, required: true, uppercase: true, trim: true },
  vehicleMake: { type: String, default: '' },
  vehicleModel: { type: String, default: '' },
  vehicleColor: { type: String, default: '' },
  driverName: { type: String, default: '' },
  driverPhone: { type: String, default: '' },
  permitNumber: { type: String, default: '' },
  parkingSpace: { type: String, default: '' },
  purpose: { type: String, default: '' },
  violationType: { type: String, default: '' },
  notes: { type: String, default: '' },
  guardId: { type: String, required: true },
  guardName: { type: String, default: 'Guard' },
  checkedInAt: { type: Date, default: Date.now },
  checkedOutAt: Date,
  status: { type: String, enum: ['Parked', 'Checked Out', 'Open Violation', 'Resolved'], default: 'Parked' },
  resolvedAt: Date,
}, { timestamps: true });

const parkingManagerSchema = new mongoose.Schema({
  companyId: { type: String, required: true, index: true },
  postSiteId: { type: String, required: true, index: true },
  postSiteName: { type: String, default: '' },
  zoneName: { type: String, required: true, trim: true },
  zoneCode: { type: String, default: '', uppercase: true, trim: true },
  capacity: { type: Number, default: 20, min: 1 },
  maxStayMinutes: { type: Number, default: 480, min: 1 },
  instructions: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  createdById: String,
  createdByName: String,
  records: [parkingRecordSchema],
}, { timestamps: true });

module.exports = mongoose.models.ParkingManager || mongoose.model('ParkingManager', parkingManagerSchema);
