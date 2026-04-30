
const myModule = require('./index.js');
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const passport = require("passport");
const session = require("express-session");
const _ = require('lodash');
var companyInfo = require(__dirname + "/db/companyinfodb.js");
const { Types } = require('mongoose');
const Report = require( "./src/models/report.js");

const app = myModule.main;
// const User = myModule.userDB;
const CalendarEvent = require("./src/models/CalendarEvents.js");

// IMPORTANT middleware (if not already)
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));


// GET events
app.get("/api/events", async (req, res) => {
  try {
    const { companyId, userId } = req.query;
    if (!companyId || !userId) return res.status(400).json({ error: "companyId and userId required" });

    const events = await CalendarEvent.find({ companyId, userId }).sort({ start: 1 });

    res.json(
      events.map(e => ({
       id: e._id.toString(),
  title: e.title,
  start: e.start,
  end: e.end,
  allDay: e.allDay,
  className: e.className,
  createdAt: e.createdAt, // ✅ add this
  extendedProps: {
    description: e.description
  }
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load events" });
  }
});

// CREATE event
app.post("/api/events", async (req, res) => {
  try {
    console.log("REQ.BODY =>", req.body);

    const event = await CalendarEvent.create({
      companyId: req.body.companyId,
      userId: req.body.userId,
      title: req.body.title,
      start: req.body.start,
      end: req.body.end,
      allDay: req.body.allDay,
      className: req.body.className,

      // ✅ these MUST be included
      assignedTo: req.body.assignedTo,
      postSiteId: req.body.postSiteId,
      frequency: req.body.frequency,
      description: req.body.description
    });

    console.log("SAVED =>", event);

    res.json(event);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});


// UPDATE event (drag/drop/resize/edit)
app.put("/api/events/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Only allow updating safe fields
    const allowed = ["title", "description", "start", "end", "allDay", "className"];
    const update = {};
    for (const k of allowed) if (k in req.body) update[k] = req.body[k];

    await CalendarEvent.findByIdAndUpdate(id, update, { new: true });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Failed to update event" });
  }
});

// DELETE event
app.delete("/api/events/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await CalendarEvent.findByIdAndDelete(id);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Failed to delete event" });
  }
});
