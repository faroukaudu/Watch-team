const myModule = require("./index.js");
const VehiclePatrol = require("./src/models/VehiclePatrol");
const mongoose = require("mongoose");
const companySchema = require("./db/companyinfodb.js");
const Company = mongoose.models.Company || mongoose.model("Company", companySchema);

const app = myModule.main;

function requireWebUser(req, res, next) {
  if (!req.user) return res.redirect("/sign-in");
  next();
}

function companyIdFor(req) {
  return String(req.user?.assignedCompanyID || "");
}

function safeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sessionDurationSeconds(session) {
  if (!session?.startedAt) return 0;
  const end = session.completedAt ? new Date(session.completedAt) : new Date();
  const elapsed = Math.floor((end.getTime() - new Date(session.startedAt).getTime()) / 1000);
  return Math.max(0, elapsed - Number(session.totalPausedSeconds || 0));
}

// WEB: Vehicle Patrol workspace
app.get("/vehicle-patrol", requireWebUser, async (req, res) => {
  try {
    const companyId = companyIdFor(req);
    const company = await Company.findById(companyId).lean();
    const patrols = await VehiclePatrol.find({ companyId })
      .sort({ isActive: -1, createdAt: -1 })
      .lean();

    const sessions = patrols
      .flatMap((patrol) => (patrol.sessions || []).map((session) => ({
        ...session,
        patrolId: patrol._id,
        patrolName: patrol.patrolName,
        postSiteName: patrol.postSiteName,
        vehicleLabel: patrol.vehicleLabel,
        targetCount: patrol.targetCount,
        counterLabel: patrol.counterLabel,
        liveDurationSeconds: sessionDurationSeconds(session),
      })))
      .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));

    res.render("dashboard/vehicle-patrol", {
      userInfo: req.user,
      patrols,
      sessions,
      postSites: company?.postSite || [],
      success: req.query.success || "",
      error: req.query.error || "",
    });
  } catch (error) {
    console.error("Vehicle patrol page error:", error);
    res.status(500).send("Unable to load Vehicle Patrol.");
  }
});

// WEB: create patrol template
app.post("/vehicle-patrol/create", requireWebUser, async (req, res) => {
  try {
    const companyId = companyIdFor(req);
    const {
      postSiteId,
      postSiteName,
      patrolName,
      vehicleLabel,
      instructions,
      counterLabel,
      targetCount,
      expectedDurationMinutes,
    } = req.body;

    if (!postSiteId || !patrolName) {
      return res.redirect("/vehicle-patrol?error=Post+site+and+patrol+name+are+required");
    }

    await VehiclePatrol.create({
      companyId,
      postSiteId: String(postSiteId),
      postSiteName: String(postSiteName || ""),
      patrolName: String(patrolName).trim(),
      vehicleLabel: String(vehicleLabel || "Patrol Vehicle").trim(),
      instructions: String(instructions || "").trim(),
      counterLabel: String(counterLabel || "Patrol rounds").trim(),
      targetCount: Math.max(1, safeNumber(targetCount, 1)),
      expectedDurationMinutes: Math.max(1, safeNumber(expectedDurationMinutes, 30)),
      createdById: String(req.user._id || ""),
      createdByName: String(req.user.username || "Administrator"),
    });

    res.redirect("/vehicle-patrol?success=Patrol+option+created");
  } catch (error) {
    console.error("Create vehicle patrol error:", error);
    res.redirect("/vehicle-patrol?error=Unable+to+create+patrol");
  }
});

app.post("/vehicle-patrol/:id/toggle", requireWebUser, async (req, res) => {
  try {
    const patrol = await VehiclePatrol.findOne({ _id: req.params.id, companyId: companyIdFor(req) });
    if (patrol) {
      patrol.isActive = !patrol.isActive;
      await patrol.save();
    }
    res.redirect("/vehicle-patrol?success=Patrol+status+updated");
  } catch (error) {
    res.redirect("/vehicle-patrol?error=Unable+to+update+patrol");
  }
});

app.post("/vehicle-patrol/:id/delete", requireWebUser, async (req, res) => {
  try {
    const patrol = await VehiclePatrol.findOne({ _id: req.params.id, companyId: companyIdFor(req) });
    if (!patrol) return res.redirect("/vehicle-patrol?error=Patrol+not+found");
    if ((patrol.sessions || []).length) {
      patrol.isActive = false;
      await patrol.save();
      return res.redirect("/vehicle-patrol?success=Patrol+archived+to+preserve+history");
    }
    await patrol.deleteOne();
    res.redirect("/vehicle-patrol?success=Patrol+deleted");
  } catch (error) {
    res.redirect("/vehicle-patrol?error=Unable+to+delete+patrol");
  }
});

// MOBILE: list patrol options for a guard/post site
app.get("/api/mobile/vehicle-patrol", async (req, res) => {
  try {
    const companyId = String(req.query.companyId || "");
    const postSiteId = String(req.query.postSiteId || "");
    const guardId = String(req.query.guardId || "");
    if (!companyId || !guardId) {
      return res.status(400).json({ success: false, message: "companyId and guardId are required" });
    }

    const query = { companyId, isActive: true };
    if (postSiteId) query.postSiteId = postSiteId;
    const patrols = await VehiclePatrol.find(query).sort({ createdAt: -1 }).lean();

    const items = patrols.map((patrol) => {
      const activeSession = (patrol.sessions || []).find(
        (session) => String(session.guardId) === guardId && ["Active", "Paused"].includes(session.status)
      );
      const recent = (patrol.sessions || [])
        .filter((session) => String(session.guardId) === guardId)
        .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))[0];
      return { ...patrol, activeSession: activeSession || null, lastSession: recent || null };
    });

    res.json({ success: true, patrols: items });
  } catch (error) {
    console.error("Mobile patrol list error:", error);
    res.status(500).json({ success: false, message: "Unable to load patrol options" });
  }
});

app.post("/api/mobile/vehicle-patrol/:id/start", async (req, res) => {
  try {
    const { companyId, guardId, guardName } = req.body;
    const patrol = await VehiclePatrol.findOne({ _id: req.params.id, companyId: String(companyId), isActive: true });
    if (!patrol) return res.status(404).json({ success: false, message: "Patrol option not found" });

    const anotherActive = await VehiclePatrol.findOne({
      companyId: String(companyId),
      sessions: { $elemMatch: { guardId: String(guardId), status: { $in: ["Active", "Paused"] } } },
    });
    if (anotherActive) {
      return res.status(409).json({ success: false, message: "Complete your active patrol before starting another one" });
    }

    patrol.sessions.push({ guardId: String(guardId), guardName: guardName || "Guard", status: "Active" });
    await patrol.save();
    const session = patrol.sessions[patrol.sessions.length - 1];
    res.json({ success: true, patrolId: patrol._id, session });
  } catch (error) {
    console.error("Start patrol error:", error);
    res.status(500).json({ success: false, message: "Unable to start patrol" });
  }
});

app.patch("/api/mobile/vehicle-patrol/:patrolId/session/:sessionId", async (req, res) => {
  try {
    const { companyId, guardId, action, counter, notes } = req.body;
    const patrol = await VehiclePatrol.findOne({ _id: req.params.patrolId, companyId: String(companyId) });
    if (!patrol) return res.status(404).json({ success: false, message: "Patrol not found" });
    const session = patrol.sessions.id(req.params.sessionId);
    if (!session || String(session.guardId) !== String(guardId)) {
      return res.status(404).json({ success: false, message: "Patrol session not found" });
    }

    if (action === "pause" && session.status === "Active") {
      session.status = "Paused";
      session.pausedAt = new Date();
    } else if (action === "resume" && session.status === "Paused") {
      if (session.pausedAt) {
        session.totalPausedSeconds += Math.max(0, Math.floor((Date.now() - new Date(session.pausedAt).getTime()) / 1000));
      }
      session.pausedAt = undefined;
      session.status = "Active";
    } else if (action === "complete") {
      if (session.status === "Paused" && session.pausedAt) {
        session.totalPausedSeconds += Math.max(0, Math.floor((Date.now() - new Date(session.pausedAt).getTime()) / 1000));
      }
      session.status = "Completed";
      session.completedAt = new Date();
      session.durationSeconds = sessionDurationSeconds(session);
      session.pausedAt = undefined;
    } else if (action === "cancel") {
      session.status = "Cancelled";
      session.completedAt = new Date();
      session.durationSeconds = sessionDurationSeconds(session);
    }

    if (counter !== undefined) session.counter = Math.max(0, safeNumber(counter, session.counter));
    if (notes !== undefined) session.notes = String(notes || "").trim();
    await patrol.save();
    res.json({ success: true, session });
  } catch (error) {
    console.error("Update patrol session error:", error);
    res.status(500).json({ success: false, message: "Unable to update patrol" });
  }
});

module.exports = { VehiclePatrol };
