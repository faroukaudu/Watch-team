const myModule = require("./index.js");
const { requirePremiumWebFeature } = require("./src/middleware/requirePremiumWebFeature");
const app = myModule.main;

// Adjust model paths if your names differ
const Event = require("./src/models/CalendarEvents");
const IncidentReport = require("./src/models/report");
const Passdown = require("./src/models/Passdown");
const WatchMode = require("./src/models/WatchMode");
const TimeClock = require("./src/models/ScheduledPostSiteReportLog");
const mongoose = require("mongoose");
const companyInfo = require("./db/companyinfodb");

const Company =
  mongoose.models.Company || mongoose.model("Company", companyInfo);

function startEndOfDay(dateValue) {
  const date = dateValue ? new Date(dateValue) : new Date();

  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function formatDateTime(value) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString();
}

function buildActivity(type, item, description) {
  return {
    id: String(item._id || ""),
    type,
    guardName: item.guardName || item.createdByName || item.guard || "Guard",
    postSiteName: item.postSiteName || item.siteName || "N/A",
    time: item.createdAt || item.updatedAt || item.checkInTime || item.clockInTime,
    description,
    raw: item,
  };
}

// MOBILE + WEB API
app.get("/api/dar", async (req, res) => {
  try {
    const { companyId, postSiteId, date } = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "companyId is required",
      });
    }

    const { start, end } = startEndOfDay(date);

    const baseFilter = {
      companyId: String(companyId),
      createdAt: { $gte: start, $lte: end },
    };

    if (postSiteId && postSiteId !== "all") {
      baseFilter.postSiteId = String(postSiteId);
    }

    const [
      events,
      incidents,
      passdowns,
      watchModes,
      timeClocks,
    ] = await Promise.all([
      Event.find(baseFilter).lean().catch(() => []),
      IncidentReport.find(baseFilter).lean().catch(() => []),
      Passdown.find(baseFilter).lean().catch(() => []),
      WatchMode.find(baseFilter).lean().catch(() => []),
      TimeClock.find(baseFilter).lean().catch(() => []),
    ]);

    const activities = [];

    events.forEach((item) => {
      activities.push(
        buildActivity(
          "Event",
          item,
          `${item.guardName || "A guard"} accepted or completed an event. Event: ${item.title || item.eventName || item.name || "Untitled event"}. Status: ${item.status || "N/A"}. Details: ${item.description || item.note || "No details provided."}`
        )
      );
    });

    incidents.forEach((item) => {
      activities.push(
        buildActivity(
          "Incident",
          item,
          `${item.guardName || "A guard"} submitted an incident report. Incident Type: ${item.incidentType || item.type || "N/A"}. Severity: ${item.severity || "N/A"}. Details: ${item.description || item.details || item.note || "No details provided."}`
        )
      );
    });

    passdowns.forEach((item) => {
      activities.push(
        buildActivity(
          "Passdown",
          item,
          `${item.guardName || "A guard"} created a passdown log. Subject: ${item.subject || item.title || "Passdown"}. Details: ${item.details || item.note || item.description || "No details provided."}`
        )
      );
    });

    watchModes.forEach((item) => {
      activities.push(
        buildActivity(
          "WatchMode",
          item,
          `${item.guardName || "A guard"} submitted a WatchMode video feed. Note: ${item.note || "No note provided."}`
        )
      );
    });

    timeClocks.forEach((item) => {
      const clockIn = item.clockInTime || item.checkInTime || item.startTime;
      const clockOut = item.clockOutTime || item.checkOutTime || item.endTime;

      activities.push(
        buildActivity(
          "TimeClock",
          item,
          `${item.guardName || "A guard"} recorded time clock activity. Clock In: ${formatDateTime(clockIn)}. Clock Out: ${formatDateTime(clockOut)}. Status: ${item.status || "N/A"}.`
        )
      );
    });

    activities.sort((a, b) => new Date(a.time || 0) - new Date(b.time || 0));

    const summary = {
      date: date || new Date().toISOString().split("T")[0],
      totalActivities: activities.length,
      events: events.length,
      incidents: incidents.length,
      passdowns: passdowns.length,
      watchModes: watchModes.length,
      timeClockRecords: timeClocks.length,
    };

    return res.json({
      success: true,
      summary,
      activities,
    });
  } catch (error) {
    console.error("DAR API error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error loading DAR",
    });
  }
});

app.delete("/api/dar/:type/:id/delete", async (req, res) => {
  try {
    if (!req.user || !req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const companyId = String(req.user.assignedCompanyID || "");
    const models = {
      Event,
      Incident: IncidentReport,
      Passdown,
      WatchMode,
      TimeClock,
    };

    const Model = models[req.params.type];
    if (!Model) {
      return res.status(400).json({ success: false, message: "Unsupported DAR record type" });
    }

    const deleted = await Model.findOneAndDelete({
      _id: req.params.id,
      companyId,
    });

    if (!deleted) {
      return res.status(404).json({ success: false, message: "DAR record not found" });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("Delete DAR record error:", error);
    return res.status(500).json({ success: false, message: "Unable to delete DAR record" });
  }
});

// WEB PAGE
app.get("/dar", requirePremiumWebFeature("DAR"), async (req, res) => {
  try {
    if (!req.isAuthenticated()) return res.redirect("/sign-in");

    const companyId = String(req.user.assignedCompanyID || "");

    const company = await Company.findOne({ _id: companyId }).lean();

    const postSites = company && Array.isArray(company.postSite)
      ? company.postSite
      : [];

    res.render("dashboard/dar", {
      userInfo: req.user,
      postSites,
    });
  } catch (error) {
    console.error("DAR page error:", error);
    res.status(500).send("Server error loading DAR page");
  }
});