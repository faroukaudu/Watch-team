// const http = require('http');
const { requirePremiumWebFeature } = require("./src/middleware/requirePremiumWebFeature");
// const myModule = require('./index.js');
// const auth = require('./authentication.js');
// const company = require('./company.js');
// const mobile = require('./mobile_api.js');
// const msgsend = require('./msg_send.js');
// const nodemailer = require('./nodemailer.js');
// const reports = require('./reports.js');
// const chatAPI = require('./routes/chat_api.js');
// const calendar = require('./calendar.js');
// const payment = require('./payment.js');
// const gps = require('./gps_map.js');
// // const socket = require('./socket.js');
// // const mobileReport = require('./src/routes/reports.js');
// // const mobileUpload = require('./src/routes/uploads.js');
// // const upLoad = require('./upload.js');

// // const reportRoutes = require("./src/routes/reports.js");
// // const uploadRoutes = require("./src/routes/uploads.js");


// // const app = myModule.main;
// // app.use("/reports", reportRoutes);
// // app.use("/uploads", uploadRoutes);


// const server = myModule.server;

// server.listen(process.env.PORT || 9000, function(req,res){
//     console.log("Watch TEAM is now running @ port 9000!");
//   });
  
const http = require("http");
const { Server } = require("socket.io");

const myModule = require("./index.js");
const attachSubscription = require("./src/middleware/attachSubscription");
const { requireActiveSubscription, requireFeature, requireNumericFeature  } = require("./src/middleware/requireSubscription");
const { isClientUser, getClientScope } = require("./src/utils/clientScope");


// load all your route/modules (keep these)
require("./authentication.js");
require("./company.js");
require("./mobile_api.js");
require("./msg_send.js");
require("./nodemailer.js");
require("./reports.js");
require("./routes/chat_api.js");
require("./calendar.js");
require("./payment.js");
require("./gps_map.js");
require("./payroll.js");
require("./webhook.js");
require("./platform_admin.js");
require("./note.js");
require("./mobile_events.js");
require("./dispatch");
require("./visitors");
require("./checklist");
require("./scheduler");
require("./tasks");
require("./site_tour");
require("./vehicle_patrol");
require("./parking_manager");
require("./passdown");
require("./watchmode");
require("./dar");

// require("./src/routes/billing.js");

const { registerSocketLogic } = require("./socket.js");

const app = myModule.main; // express app from index.js

// ✅ Create ONE server here
const server = http.createServer(app);

// ✅ Attach socket.io to THAT server
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// ✅ Register Chat Socket Logic here so it works on port 9000
registerSocketLogic(io, myModule.userDB);
app.set("socketio", io);
const NotificationService = require("./src/services/NotificationService");

const lastLocations = new Map();
const onlineGuards  = new Set();
const TrackingLog = require("./src/models/TrackingLog");

const TRACKING_ONLINE_WINDOW_MS = 2 * 60 * 1000;
const guardLastSavedAt = new Map();

function normalizeRole(value) {
  const role = String(value || "User").trim().replace(/[_-]+/g, " ");
  return role.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function coordinateLabel(lat, lng, label) {
  if (label && String(label).trim()) return String(label).trim();
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return "Location unavailable";
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

async function saveTrackingLog(data) {
  try {
    return await TrackingLog.create({
      companyId: String(data.companyId || ""),
      userId: String(data.userId || ""),
      userName: data.userName || "User",
      userType: normalizeRole(data.userType),
      source: data.source,
      status: data.status,
      eventType: data.eventType,
      latitude: Number.isFinite(Number(data.latitude)) ? Number(data.latitude) : null,
      longitude: Number.isFinite(Number(data.longitude)) ? Number(data.longitude) : null,
      accuracy: Number.isFinite(Number(data.accuracy)) ? Number(data.accuracy) : null,
      speed: Number.isFinite(Number(data.speed)) ? Number(data.speed) : null,
      heading: Number.isFinite(Number(data.heading)) ? Number(data.heading) : null,
      locationLabel: coordinateLabel(data.latitude, data.longitude, data.locationLabel),
      recordedAt: data.recordedAt ? new Date(data.recordedAt) : new Date(),
    });
  } catch (error) {
    console.error("Tracking history save failed:", error.message);
    return null;
  }
}

function requireTrackingAuth(req, res, next) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ ok: false, message: "Authentication required" });
  }
  next();
}

async function getCurrentTrackingRows(companyId) {
  const rows = await TrackingLog.aggregate([
    { $match: { companyId: String(companyId) } },
    { $sort: { recordedAt: -1 } },
    {
      $group: {
        _id: { userId: "$userId", source: "$source" },
        record: { $first: "$$ROOT" },
      },
    },
    { $replaceRoot: { newRoot: "$record" } },
    { $sort: { status: -1, recordedAt: -1 } },
  ]);

  const now = Date.now();
  return rows.map((row) => {
    const age = now - new Date(row.recordedAt).getTime();

    // Guards explicitly check in and check out from the mobile app.
    // Do not mark a stationary guard offline merely because no new GPS point
    // has been sent within the web-user activity window.
    const online = row.source === "guard"
      ? row.status === "online"
      : row.status === "online" && age <= TRACKING_ONLINE_WINDOW_MS;

    return { ...row, status: online ? "online" : "offline" };
  });
}

io.on("connection", (socket) => {
  console.log("Web client connected:", socket.id);


socket.on("join", ({ companyId, guardId }) => {
  if (companyId) socket.join(`company:${companyId}`);
  if (guardId) socket.join(`guard:${guardId}`);

  // ✅ after refresh, if guard is already online, push state + last location
  if (guardId && onlineGuards.has(String(guardId))) {
    socket.emit("guard:online", { guardId });

    const last = lastLocations.get(String(guardId));
    if (last) socket.emit("guard:location", last);
  }
});

  socket.on("disconnect", () => console.log("Disconnected:", socket.id));
});

// ✅ Your flutter endpoint must be in the same app
app.post("/api/guard/location", (req, res) => {


  const { companyId, guardId, lat, lng, speed, heading, accuracy, ts, guardName } = req.body;

  const _lat = Number(lat);
  const _lng = Number(lng);

  
  if (!companyId || !guardId || Number.isNaN(_lat) || Number.isNaN(_lng)) {
    return res.status(400).json({ ok: false, msg: "Missing/invalid fields" });
  }

  const payload = {
    companyId,
    guardId,
    guardName: guardName || "Guard",
    lat: _lat,
    lng: _lng,
    speed,
    heading,
    accuracy,
    ts: ts || Date.now(),
  };

  lastLocations.set(String(guardId), payload);

  // Save a guard location snapshot even when no administrator is online.
  // Throttle database writes to one snapshot every 20 seconds per guard.
  const saveKey = String(guardId);
  const now = Date.now();
  const lastSaved = guardLastSavedAt.get(saveKey) || 0;
  if (now - lastSaved >= 20000) {
    guardLastSavedAt.set(saveKey, now);
    saveTrackingLog({
      companyId,
      userId: guardId,
      userName: guardName || "Guard",
      userType: "Guard",
      source: "guard",
      status: "online",
      eventType: "location",
      latitude: _lat,
      longitude: _lng,
      accuracy,
      speed,
      heading,
      recordedAt: ts || now,
    });
  }

  io.to(`company:${companyId}`).emit("guard:location", payload);
  io.to(`guard:${guardId}`).emit("guard:location", payload);

  return res.json({ ok: true });
});

app.post("/api/guard/checkin", async (req, res) => {
  const { companyId, guardId, guardName } = req.body;
  if (!companyId || !guardId) return res.status(400).json({ ok:false });

  onlineGuards.add(String(guardId));
    // Save guardId to the logged-in user's session (Passport session)
  req.session.lastGuardId = String(guardId);

  saveTrackingLog({
    companyId,
    userId: guardId,
    userName: guardName || "Guard",
    userType: "Guard",
    source: "guard",
    status: "online",
    eventType: "checkin",
  });

  io.to(`company:${companyId}`).emit("guard:online", { guardId, guardName });
  io.to(`company:${companyId}`).emit("tracking:changed");

  try {
    const guard = await myModule.userDB.findById(guardId).select("guardPostSite fullname");
    const postSiteId = guard?.guardPostSite?.[0]?.postSiteID || "";
    await NotificationService.notifyOperational(app, {
      companyId, postSiteId, type: "guard_check_in", title: "Guard Checked In",
      message: `${guardName || guard?.fullname || "A guard"} checked in.`,
      targetUrl: "/time-log", referenceId: guardId, actorUserId: guardId,
      actorName: guardName || guard?.fullname || "Guard"
    });
  } catch (error) { console.error("Check-in notification:", error.message); }

  // Optionally send last location immediately
  const last = lastLocations.get(String(guardId));
  if (last) io.to(`company:${companyId}`).emit("guard:location", last);

  return res.json({ ok:true });
});


app.post("/api/guard/checkout", async (req, res) => {
  const { companyId, guardId } = req.body;
  if (!companyId || !guardId) return res.status(400).json({ ok:false });

  onlineGuards.delete(String(guardId));

  const last = lastLocations.get(String(guardId));
  saveTrackingLog({
    companyId,
    userId: guardId,
    userName: (last && last.guardName) || "Guard",
    userType: "Guard",
    source: "guard",
    status: "offline",
    eventType: "checkout",
    latitude: last && last.lat,
    longitude: last && last.lng,
    accuracy: last && last.accuracy,
  });

  io.to(`company:${companyId}`).emit("guard:offline", { guardId });
  io.to(`company:${companyId}`).emit("tracking:changed");
  try {
    const guard = await myModule.userDB.findById(guardId).select("guardPostSite fullname");
    const postSiteId = guard?.guardPostSite?.[0]?.postSiteID || "";
    await NotificationService.notifyOperational(app, {
      companyId, postSiteId, type: "guard_check_out", title: "Guard Checked Out",
      message: `${guard?.fullname || "A guard"} checked out.`, targetUrl: "/time-log",
      referenceId: guardId, actorUserId: guardId, actorName: guard?.fullname || "Guard"
    });
  } catch (error) { console.error("Check-out notification:", error.message); }

  return res.json({ ok:true });
});






// ===== Persistent live tracking and history =====
app.post("/api/tracking/web-location", requireTrackingAuth, async (req, res) => {
  const companyId = String(req.user.assignedCompanyID || req.user._id || "");
  const latitude = Number(req.body.latitude ?? req.body.lat);
  const longitude = Number(req.body.longitude ?? req.body.lng);

  if (!companyId || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return res.status(400).json({ ok: false, message: "Invalid location" });
  }

  const payload = {
    companyId,
    userId: String(req.user._id),
    userName: req.user.fullname || req.user.username || "Current User",
    userType: req.user.userType || "User",
    source: "web",
    status: "online",
    eventType: "web-location",
    latitude,
    longitude,
    accuracy: req.body.accuracy,
    locationLabel: req.body.locationLabel,
  };

  const saved = await saveTrackingLog(payload);
  io.to(`company:${companyId}`).emit("web-user:location", {
    ...payload,
    recordedAt: saved ? saved.recordedAt : new Date(),
  });
  io.to(`company:${companyId}`).emit("tracking:changed");
  return res.json({ ok: true });
});

app.post("/api/tracking/web-offline", requireTrackingAuth, async (req, res) => {
  const companyId = String(req.user.assignedCompanyID || req.user._id || "");
  await saveTrackingLog({
    companyId,
    userId: String(req.user._id),
    userName: req.user.fullname || req.user.username || "Current User",
    userType: req.user.userType || "User",
    source: "web",
    status: "offline",
    eventType: "web-offline",
    latitude: req.body.latitude,
    longitude: req.body.longitude,
    accuracy: req.body.accuracy,
  });
  io.to(`company:${companyId}`).emit("tracking:changed");
  return res.json({ ok: true });
});

app.get("/api/tracking/current", requireTrackingAuth, async (req, res) => {
  try {
    const companyId = String(req.user.assignedCompanyID || req.user._id || "");
    let rows = await getCurrentTrackingRows(companyId);
    if (isClientUser(req.user)) {
      const { allowedGuardIds } = await getClientScope(req.user);
      rows = rows.filter((row) => allowedGuardIds.includes(String(row.userId || row.guardId || "")));
    }
    return res.json({ ok: true, rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, message: "Unable to load tracking status" });
  }
});

app.get("/api/tracking/history", requireTrackingAuth, async (req, res) => {
  try {
    const companyId = String(req.user.assignedCompanyID || req.user._id || "");
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 10), 200);
    const query = { companyId };
    if (isClientUser(req.user)) {
      const { allowedGuardIds } = await getClientScope(req.user);
      query.userId = { $in: allowedGuardIds };
    }

    if (req.query.source && ["guard", "web"].includes(req.query.source)) {
      query.source = req.query.source;
    }
    if (req.query.status && ["online", "offline"].includes(req.query.status)) {
      query.status = req.query.status;
    }
    if (req.query.userId) {
      if (isClientUser(req.user)) {
        const { allowedGuardIds } = await getClientScope(req.user);
        if (!allowedGuardIds.includes(String(req.query.userId))) {
          return res.status(403).json({ ok: false, message: "This guard is outside your assigned post site." });
        }
      }
      query.userId = String(req.query.userId);
    }
    if (req.query.from || req.query.to) {
      query.recordedAt = {};
      if (req.query.from) query.recordedAt.$gte = new Date(req.query.from);
      if (req.query.to) {
        const to = new Date(req.query.to);
        to.setHours(23, 59, 59, 999);
        query.recordedAt.$lte = to;
      }
    }

    const [rows, total] = await Promise.all([
      TrackingLog.find(query)
        .sort({ recordedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      TrackingLog.countDocuments(query),
    ]);

    return res.json({ ok: true, rows, page, limit, total, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, message: "Unable to load tracking history" });
  }
});

app.get(
  "/live-tracking",
  requirePremiumWebFeature("GPS Tracking"),
  (req, res) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) return res.redirect("/sign-in");
    return res.render("dashboard/live-track", { userInfo: req.user, guardId: "" });
  }
);

app.get(
  "/tracking-history",
  requirePremiumWebFeature("Tracking History"),
  (req, res) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) return res.redirect("/sign-in");
    return res.render("dashboard/tracking-history", { userInfo: req.user });
  }
);

// ✅ ONE listen only (here)
server.listen(process.env.PORT || 9000, () => {
  console.log("Watch TEAM is now running @ port 9000!");
});
