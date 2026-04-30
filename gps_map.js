// const myModule = require('./index.js');
// const bodyParser = require("body-parser");
// const mongoose = require("mongoose");
// const passport = require("passport");
// const session = require("express-session");
// const http = require("http");
// const { Server } = require("socket.io");
// const _ = require('lodash');
// var companyInfo = require(__dirname + "/db/companyinfodb.js");
// const { ObjectId } = require("mongodb");
// const MobileReport = require("./src/models/report.js");

// const app = myModule.main;
// const User = myModule.userDB;
// const Company = mongoose.model("Company", companyInfo);


// const server = http.createServer(app);

// const io = new Server(server, {
//   cors: { origin: "*", methods: ["GET", "POST"] },
// });

// io.on("connection", (socket) => {
//   console.log("Web client connected:", socket.id);

//   socket.on("join", ({ companyId, guardId }) => {
//     if (companyId) socket.join(`company:${companyId}`);
//     if (guardId) socket.join(`guard:${guardId}`);
//   });

//   socket.on("disconnect", () => console.log("Disconnected:", socket.id));
// });

// // ✅ Put your endpoint in the SAME express app
// app.post("/api/guard/location", (req, res) => {
//   const { companyId, guardId, lat, lng, speed, heading, accuracy, ts } = req.body;

//   // IMPORTANT: lat/lng often arrive as strings from Flutter
//   const _lat = Number(lat);
//   const _lng = Number(lng);

//   if (!companyId || !guardId || Number.isNaN(_lat) || Number.isNaN(_lng)) {
//     return res.status(400).json({ ok: false, msg: "Missing/invalid fields" });
//   }

//   const payload = {
//     companyId,
//     guardId,
//     lat: _lat,
//     lng: _lng,
//     speed,
//     heading,
//     accuracy,
//     ts: ts || Date.now(),
//   };

//   io.to(`company:${companyId}`).emit("guard:location", payload);
//   io.to(`guard:${guardId}`).emit("guard:location", payload);

//   return res.json({ ok: true });
// });

// ✅ The ONLY listen
// server.listen(process.env.PORT || 9000, () => {
//   console.log("Watch TEAM running @ port 9000!");
// });


