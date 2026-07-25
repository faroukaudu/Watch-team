const myModule = require('./index.js');
const mongoose = require('mongoose');
const ParkingManager = require('./src/models/ParkingManager');
const companySchema = require('./db/companyinfodb.js');
const Company = mongoose.models.Company || mongoose.model('Company', companySchema);
const app = myModule.main;

function requireWebUser(req, res, next) {
  if (!req.user) return res.redirect('/sign-in');
  next();
}
function companyIdFor(req) { return String(req.user?.assignedCompanyID || ''); }
function safeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function durationMinutes(record) {
  if (!record?.checkedInAt) return 0;
  const end = record.checkedOutAt ? new Date(record.checkedOutAt) : new Date();
  return Math.max(0, Math.floor((end - new Date(record.checkedInAt)) / 60000));
}

app.get('/parking-manager', requireWebUser, async (req, res) => {
  try {
    const companyId = companyIdFor(req);
    const [company, zones] = await Promise.all([
      Company.findById(companyId).lean(),
      ParkingManager.find({ companyId }).sort({ isActive: -1, createdAt: -1 }).lean(),
    ]);
    const records = zones.flatMap(zone => (zone.records || []).map(record => ({
      ...record,
      zoneId: zone._id,
      zoneName: zone.zoneName,
      postSiteName: zone.postSiteName,
      maxStayMinutes: zone.maxStayMinutes,
      liveDurationMinutes: durationMinutes(record),
      isOverstay: record.status === 'Parked' && durationMinutes(record) > Number(zone.maxStayMinutes || 0),
    }))).sort((a, b) => new Date(b.checkedInAt) - new Date(a.checkedInAt));
    res.render('dashboard/parking-manager', {
      userInfo: req.user,
      zones,
      records,
      postSites: company?.postSite || [],
      success: req.query.success || '',
      error: req.query.error || '',
    });
  } catch (error) {
    console.error('Parking Manager page error:', error);
    res.status(500).send('Unable to load Parking Manager.');
  }
});

app.post('/parking-manager/create', requireWebUser, async (req, res) => {
  try {
    const { postSiteId, postSiteName, zoneName, zoneCode, capacity, maxStayMinutes, instructions } = req.body;
    if (!postSiteId || !zoneName) return res.redirect('/parking-manager?error=Post+site+and+zone+name+are+required');
    await ParkingManager.create({
      companyId: companyIdFor(req), postSiteId: String(postSiteId), postSiteName: String(postSiteName || ''),
      zoneName: String(zoneName).trim(), zoneCode: String(zoneCode || '').trim(),
      capacity: Math.max(1, safeNumber(capacity, 20)), maxStayMinutes: Math.max(1, safeNumber(maxStayMinutes, 480)),
      instructions: String(instructions || '').trim(), createdById: String(req.user._id || ''),
      createdByName: String(req.user.username || 'Administrator'),
    });
    res.redirect('/parking-manager?success=Parking+zone+created');
  } catch (error) {
    console.error('Create parking zone error:', error);
    res.redirect('/parking-manager?error=Unable+to+create+parking+zone');
  }
});

app.post('/parking-manager/:id/toggle', requireWebUser, async (req, res) => {
  try {
    const zone = await ParkingManager.findOne({ _id: req.params.id, companyId: companyIdFor(req) });
    if (zone) { zone.isActive = !zone.isActive; await zone.save(); }
    res.redirect('/parking-manager?success=Parking+zone+status+updated');
  } catch (_) { res.redirect('/parking-manager?error=Unable+to+update+parking+zone'); }
});

app.post('/parking-manager/:id/delete', requireWebUser, async (req, res) => {
  try {
    const zone = await ParkingManager.findOne({
      _id: req.params.id,
      companyId: companyIdFor(req),
    });

    if (!zone) {
      return res.redirect('/parking-manager?error=Parking+zone+not+found');
    }

    await zone.deleteOne();
    return res.redirect('/parking-manager?success=Parking+zone+and+all+results+deleted');
  } catch (error) {
    console.error('Delete parking zone error:', error);
    return res.redirect('/parking-manager?error=Unable+to+delete+parking+zone');
  }
});


app.post('/parking-manager/:zoneId/record/:recordId/delete', requireWebUser, async (req, res) => {
  try {
    const zone = await ParkingManager.findOne({
      _id: req.params.zoneId,
      companyId: companyIdFor(req),
    });

    if (!zone) {
      return res.redirect('/parking-manager?error=Parking+zone+not+found');
    }

    const record = zone.records.id(req.params.recordId);
    if (!record) {
      return res.redirect('/parking-manager?error=Parking+record+not+found');
    }

    record.deleteOne();
    await zone.save();

    return res.redirect('/parking-manager?success=Parking+record+deleted');
  } catch (error) {
    console.error('Delete parking record error:', error);
    return res.redirect('/parking-manager?error=Unable+to+delete+parking+record');
  }
});
app.post('/parking-manager/:zoneId/record/:recordId/resolve', requireWebUser, async (req, res) => {
  try {
    const zone = await ParkingManager.findOne({ _id: req.params.zoneId, companyId: companyIdFor(req) });
    const record = zone?.records.id(req.params.recordId);
    if (record && record.type === 'Violation') { record.status = 'Resolved'; record.resolvedAt = new Date(); await zone.save(); }
    res.redirect('/parking-manager?success=Violation+resolved');
  } catch (_) { res.redirect('/parking-manager?error=Unable+to+resolve+violation'); }
});

app.get('/api/mobile/parking-manager', async (req, res) => {
  try {
    const companyId = String(req.query.companyId || '');
    const postSiteId = String(req.query.postSiteId || '');
    if (!companyId) return res.status(400).json({ success: false, message: 'companyId is required' });
    const query = { companyId, isActive: true };
    if (postSiteId) query.postSiteId = postSiteId;
    const zones = await ParkingManager.find(query).sort({ createdAt: -1 }).lean();
    const items = zones.map(zone => ({
      ...zone,
      occupiedCount: (zone.records || []).filter(r => r.type === 'CheckIn' && r.status === 'Parked').length,
      openViolationCount: (zone.records || []).filter(r => r.type === 'Violation' && r.status === 'Open Violation').length,
    }));
    res.json({ success: true, zones: items });
  } catch (error) {
    console.error('Mobile parking list error:', error);
    res.status(500).json({ success: false, message: 'Unable to load parking zones' });
  }
});

app.post('/api/mobile/parking-manager/:zoneId/check-in', async (req, res) => {
  try {
    const { companyId, guardId, guardName, plateNumber, vehicleMake, vehicleModel, vehicleColor, driverName, driverPhone, permitNumber, parkingSpace, purpose, notes } = req.body;
    if (!plateNumber || !guardId) return res.status(400).json({ success: false, message: 'Plate number and guard are required' });
    const zone = await ParkingManager.findOne({ _id: req.params.zoneId, companyId: String(companyId), isActive: true });
    if (!zone) return res.status(404).json({ success: false, message: 'Parking zone not found' });
    const duplicate = zone.records.find(r => r.type === 'CheckIn' && r.status === 'Parked' && r.plateNumber === String(plateNumber).trim().toUpperCase());
    if (duplicate) return res.status(409).json({ success: false, message: 'This vehicle is already checked in' });
    zone.records.push({ type: 'CheckIn', plateNumber, vehicleMake, vehicleModel, vehicleColor, driverName, driverPhone, permitNumber, parkingSpace, purpose, notes, guardId, guardName, status: 'Parked' });
    await zone.save();
    res.json({ success: true, record: zone.records[zone.records.length - 1] });
  } catch (error) {
    console.error('Parking check-in error:', error);
    res.status(500).json({ success: false, message: 'Unable to check vehicle in' });
  }
});

app.patch('/api/mobile/parking-manager/:zoneId/record/:recordId/check-out', async (req, res) => {
  try {
    const zone = await ParkingManager.findOne({ _id: req.params.zoneId, companyId: String(req.body.companyId) });
    const record = zone?.records.id(req.params.recordId);
    if (!record || record.type !== 'CheckIn') return res.status(404).json({ success: false, message: 'Parking record not found' });
    if (record.status !== 'Parked') return res.status(409).json({ success: false, message: 'Vehicle is already checked out' });
    record.status = 'Checked Out'; record.checkedOutAt = new Date();
    if (req.body.notes) record.notes = [record.notes, String(req.body.notes).trim()].filter(Boolean).join('\n');
    await zone.save();
    res.json({ success: true, record });
  } catch (error) { res.status(500).json({ success: false, message: 'Unable to check vehicle out' }); }
});

app.post('/api/mobile/parking-manager/:zoneId/violation', async (req, res) => {
  try {
    const { companyId, guardId, guardName, plateNumber, vehicleMake, vehicleModel, vehicleColor, parkingSpace, violationType, notes } = req.body;
    if (!plateNumber || !violationType || !guardId) return res.status(400).json({ success: false, message: 'Plate number, violation type and guard are required' });
    const zone = await ParkingManager.findOne({ _id: req.params.zoneId, companyId: String(companyId), isActive: true });
    if (!zone) return res.status(404).json({ success: false, message: 'Parking zone not found' });
    zone.records.push({ type: 'Violation', plateNumber, vehicleMake, vehicleModel, vehicleColor, parkingSpace, violationType, notes, guardId, guardName, status: 'Open Violation' });
    await zone.save();
    res.json({ success: true, record: zone.records[zone.records.length - 1] });
  } catch (error) { res.status(500).json({ success: false, message: 'Unable to log violation' }); }
});

module.exports = { ParkingManager };
