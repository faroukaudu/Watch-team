// const http = require('http');
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

const lastLocations = new Map();
const onlineGuards  = new Set();

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

  io.to(`company:${companyId}`).emit("guard:location", payload);
  io.to(`guard:${guardId}`).emit("guard:location", payload);

  return res.json({ ok: true });
});

app.post("/api/guard/checkin", (req, res) => {
  const { companyId, guardId, guardName } = req.body;
  if (!companyId || !guardId) return res.status(400).json({ ok:false });

  onlineGuards.add(String(guardId));
    // Save guardId to the logged-in user's session (Passport session)
  req.session.lastGuardId = String(guardId);

  io.to(`company:${companyId}`).emit("guard:online", { guardId, guardName });

  // Optionally send last location immediately
  const last = lastLocations.get(String(guardId));
  if (last) io.to(`company:${companyId}`).emit("guard:location", last);

  return res.json({ ok:true });
});


app.post("/api/guard/checkout", (req, res) => {
  const { companyId, guardId } = req.body;
  if (!companyId || !guardId) return res.status(400).json({ ok:false });

  onlineGuards.delete(String(guardId));

  io.to(`company:${companyId}`).emit("guard:offline", { guardId });

  return res.json({ ok:true });
});





// ✅ ONE listen only (here)
server.listen(process.env.PORT || 9000, () => {
  console.log("Watch TEAM is now running @ port 9000!");
});

app.get("/live-tracking", requireActiveSubscription,
  requireNumericFeature("gpsTrackingDays", 1),(req,res)=>{
    console.log("tracking here");
     const guardId = req.session.lastGuardId || ""; // fallback if none
    
    if(!req.isAuthenticated()){
    res.redirect("/sign-in");
    }    

    res.render("dashboard/live-track", {userInfo:req.user,guardId:"68fabd53f72c8e7278fdd632" });

    // FOR ALL GAURDS
    // res.render("dashboard/live-track", { userInfo: req.user, guardId: "" });
})