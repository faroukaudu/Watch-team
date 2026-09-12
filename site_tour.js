const mongoose = require("mongoose");
const myModule = require("./index.js");
const SiteTour = require("./src/models/SiteTour");

const app = myModule.main;
const User = myModule.userDB;

function buildQrValue(tourId, checkpointId) {
  return `WT_TOUR|${tourId}|${checkpointId}`;
}

// for NFC
function buildNfcValue(tourId, checkpointId) {
  return `WT_NFC_TOUR|${tourId}|${checkpointId}`;
}

function normalizeDurationKey(value) {
  const allowed = new Set(["1_week", "1_month", "3_months", "6_months", "1_year", "forever"]);
  return allowed.has(String(value)) ? String(value) : "forever";
}

function calculateScheduleEnd(startDate, durationKey) {
  if (normalizeDurationKey(durationKey) === "forever") return null;
  const end = new Date(startDate);
  switch (normalizeDurationKey(durationKey)) {
    case "1_week":
      end.setUTCDate(end.getUTCDate() + 7);
      break;
    case "1_month":
      end.setUTCMonth(end.getUTCMonth() + 1);
      break;
    case "3_months":
      end.setUTCMonth(end.getUTCMonth() + 3);
      break;
    case "6_months":
      end.setUTCMonth(end.getUTCMonth() + 6);
      break;
    default:
      end.setUTCFullYear(end.getUTCFullYear() + 1);
      break;
  }
  return end;
}

function getDateKey(date = new Date()) {
  return new Date(date).toISOString().slice(0, 10);
}

function getScheduleState(tour, now = new Date()) {
  const start = tour.scheduleStartDate ? new Date(tour.scheduleStartDate) : new Date(tour.createdAt || now);
  const end = tour.scheduleEndDate
    ? new Date(tour.scheduleEndDate)
    : calculateScheduleEnd(start, tour.durationKey || "forever");
  const active = tour.isActive !== false;
  return {
    start,
    end,
    isScheduledToday: now >= start && (!end || now < end) && active,
    isExpired: Boolean(end && now >= end),
  };
}

function decorateTourForClient(tour, now = new Date()) {
  const plain = typeof tour.toObject === "function" ? tour.toObject() : { ...tour };
  const dateKey = getDateKey(now);
  const schedule = getScheduleState(plain, now);
  const progress = Array.isArray(plain.progress) ? plain.progress : [];
  const todayProgress = progress.find((item) => item.dateKey === dateKey) || null;
  plain.scheduleStartDate = schedule.start;
  plain.scheduleEndDate = schedule.end;
  plain.isScheduledToday = schedule.isScheduledToday;
  plain.isExpired = schedule.isExpired;
  plain.todayDateKey = dateKey;
  plain.todayProgress = todayProgress;
  plain.todayStatus = todayProgress?.status || (schedule.isScheduledToday ? "Not Started" : "No Schedule");
  plain.completedToday = todayProgress?.status === "Completed";
  plain.readyToFinishToday = todayProgress?.status === "Ready to Finish";
  return plain;
}

function normalizeCheckpointName(name) {
  return String(name || "").trim().toLowerCase();
}



// WEB: Create site tour
app.post("/site-tours/create", async (req, res) => {
  try {
    const {
      companyId,
      postSiteId,
      postSiteName,
      tourName,
      description,
      checkpoints,
      duration,
    } = req.body;

    if (!companyId || !postSiteId || !tourName) {
      return res.status(400).json({
        success: false,
        message: "companyId, postSiteId, and tourName are required.",
      });
    }

    let checkpointList = [];

    if (Array.isArray(checkpoints)) {
      checkpointList = checkpoints
        .map((item) => String(item).trim())
        .filter(Boolean);
    } else if (typeof checkpoints === "string") {
      checkpointList = checkpoints
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean);
    }

    if (checkpointList.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one checkpoint is required.",
      });
    }

    const siteTour = new SiteTour({
      companyId: String(companyId),
      postSiteId: String(postSiteId),
      postSiteName: postSiteName || "",
      tourName: String(tourName).trim(),
      description: description || "",
      durationKey: normalizeDurationKey(duration),
      scheduleStartDate: new Date(),
      scheduleEndDate: calculateScheduleEnd(new Date(), duration),
      checkpoints: checkpointList.map((name, index) => ({
        name,
        description: "",
        qrCodeValue: "PENDING",
        order: index + 1,
        isActive: true,
      })),
      createdById: req.user ? String(req.user._id) : "",
      createdByName: req.user ? req.user.username : "",
      createdByUserType: req.user ? req.user.userType : "",
      isActive: true,
    });

    await siteTour.save();

    siteTour.checkpoints.forEach((point) => {
      point.qrCodeValue = buildQrValue(siteTour._id, point._id);
    });

    await siteTour.save();

    return res.redirect(
  `/view-post-site?postSiteId=${postSiteId}&success=site_tour_created`
);
  } catch (error) {
    console.error("Create site tour error:", error);
    console.error("Request body:", req.body);

    return res.status(500).json({
      success: false,
      message: "Server error creating site tour.",
    });
  }
});


// WEB: UPDATE SITE TOUR
app.post("/site-tours/:id/update", async (req, res) => {
  try {
    if (!req.user) return res.redirect("/sign-in");

    const tour = await SiteTour.findOne({
      _id: req.params.id,
      companyId: String(req.user.assignedCompanyID),
    });

    if (!tour) {
      const wantsJson = String(req.headers.accept || "").includes("application/json");
      if (wantsJson) {
        return res.status(404).json({
          success: false,
          message: "Site tour not found.",
        });
      }
      return res.status(404).send("Site tour not found.");
    }

    const checkpointNames = String(req.body.checkpoints || "")
      .split(/\r?\n/)
      .map((name) => name.trim())
      .filter(Boolean);

    if (!checkpointNames.length) {
      const wantsJson = String(req.headers.accept || "").includes("application/json");
      if (wantsJson) {
        return res.status(400).json({
          success: false,
          message: "At least one checkpoint is required.",
        });
      }
      return res.status(400).send("At least one checkpoint is required.");
    }

    tour.tourName = String(req.body.tourName || "").trim();
    tour.description = req.body.description || "";
    tour.durationKey = normalizeDurationKey(req.body.duration || tour.durationKey);
    const scheduleStart = tour.scheduleStartDate || tour.createdAt || new Date();
    tour.scheduleStartDate = scheduleStart;
    tour.scheduleEndDate = calculateScheduleEnd(scheduleStart, tour.durationKey);

    const oldCheckpoints = tour.checkpoints || [];
    const oldByName = new Map(
      oldCheckpoints.map((checkpoint) => [normalizeCheckpointName(checkpoint.name), checkpoint])
    );
    const isNfcTour = oldCheckpoints.some((checkpoint) =>
      Boolean(checkpoint.nfcTagValue)
    );

    const newlyAddedCheckpointIds = [];

    tour.checkpoints = checkpointNames.map((name, index) => {
      const old = oldByName.get(normalizeCheckpointName(name));
      const checkpointId = old ? old._id : new mongoose.Types.ObjectId();

      if (!old) {
        newlyAddedCheckpointIds.push(String(checkpointId));
      }

      return {
        _id: checkpointId,
        name,
        description: old ? old.description : "",
        qrCodeValue: old
          ? old.qrCodeValue
          : isNfcTour
            ? "NFC_ONLY"
            : buildQrValue(tour._id, checkpointId),
        nfcTagValue: old
          ? old.nfcTagValue
          : isNfcTour
            ? buildNfcValue(tour._id, checkpointId)
            : "",
        nfcWritten: old ? old.nfcWritten : false,
        nfcWrittenAt: old ? old.nfcWrittenAt : null,
        order: index + 1,
        isActive: true,
      };
    });

    await tour.save();

    const wantsJson =
      req.xhr ||
      String(req.headers.accept || "").includes("application/json") ||
      String(req.headers["content-type"] || "").includes("application/json");

    if (wantsJson) {
      return res.json({
        success: true,
        message: newlyAddedCheckpointIds.length
          ? "Site tour updated. Set up the newly added checkpoint tags."
          : "Site tour updated successfully.",
        tour,
        newlyAddedCheckpointIds,
      });
    }

    return res.redirect("back");
  } catch (error) {
    console.error("Update site tour error:", error);

    const wantsJson = String(req.headers.accept || "").includes("application/json");
    if (wantsJson) {
      return res.status(500).json({
        success: false,
        message: "Server error updating site tour.",
      });
    }

    return res.redirect("back");
  }
});

// WEB: DELETE SITE TOUR
app.post("/site-tours/:id/delete", async (req, res) => {
  try {
    if (!req.user) return res.redirect("/sign-in");

    await SiteTour.findOneAndDelete({
      _id: req.params.id,
      companyId: String(req.user.assignedCompanyID),
    });

    return res.redirect("back");
  } catch (error) {
    console.error("Delete site tour error:", error);
    return res.redirect("back");
  }
});

// WEB: Create NFC site tour
app.post("/site-tours/create-nfc", async (req, res) => {
  try {
    const {
      companyId,
      postSiteId,
      postSiteName,
      tourName,
      description,
      checkpoints,
      duration,
    } = req.body;

    if (!companyId || !postSiteId || !tourName) {
      return res.status(400).json({
        success: false,
        message: "companyId, postSiteId, and tourName are required.",
      });
    }

    let checkpointList = [];

    if (Array.isArray(checkpoints)) {
      checkpointList = checkpoints.map((item) => String(item).trim()).filter(Boolean);
    } else if (typeof checkpoints === "string") {
      checkpointList = checkpoints.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    }

    if (checkpointList.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one NFC checkpoint is required.",
      });
    }

    const siteTour = new SiteTour({
      companyId: String(companyId),
      postSiteId: String(postSiteId),
      postSiteName: postSiteName || "",
      tourName: String(tourName).trim(),
      description: description || "",
      durationKey: normalizeDurationKey(duration),
      scheduleStartDate: new Date(),
      scheduleEndDate: calculateScheduleEnd(new Date(), duration),
      checkpoints: checkpointList.map((name, index) => ({
        name,
        description: "",
        qrCodeValue: "NFC_ONLY",
        nfcTagValue: "PENDING",
        nfcWritten: false,
        order: index + 1,
        isActive: true,
      })),
      createdById: req.user ? String(req.user._id) : "",
      createdByName: req.user ? req.user.username : "",
      createdByUserType: req.user ? req.user.userType : "",
      isActive: true,
    });

    await siteTour.save();

    siteTour.checkpoints.forEach((point) => {
      point.nfcTagValue = buildNfcValue(siteTour._id, point._id);
    });

    await siteTour.save();

    return res.json({
      success: true,
      message: "NFC tour created. You can now write the NFC tags.",
      tour: siteTour,
    });
  } catch (error) {
    console.error("Create NFC tour error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error creating NFC tour.",
    });
  }
});

// WEB: Confirm NFC tag was written successfully
app.post("/api/site-tours/nfc-write-confirm", async (req, res) => {
  try {
    const { companyId, postSiteId, tourId, checkpointId } = req.body;

    if (!companyId || !postSiteId || !tourId || !checkpointId) {
      return res.status(400).json({
        success: false,
        message: "Missing NFC write confirmation data.",
      });
    }

    const siteTour = await SiteTour.findOne({
      _id: tourId,
      companyId: String(companyId),
      postSiteId: String(postSiteId),
      isActive: true,
    });

    if (!siteTour) {
      return res.status(404).json({
        success: false,
        message: "Site tour not found.",
      });
    }

    const checkpoint = siteTour.checkpoints.id(checkpointId);

    if (!checkpoint) {
      return res.status(404).json({
        success: false,
        message: "Checkpoint not found.",
      });
    }

    checkpoint.nfcWritten = true;
    checkpoint.nfcWrittenAt = new Date();

    await siteTour.save();

    return res.json({
      success: true,
      message: "NFC tag marked as written.",
    });
  } catch (error) {
    console.error("NFC write confirm error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error confirming NFC write.",
    });
  }
});

// MOBILE: Scan checkpoint NFC tag
app.post("/api/site-tours/nfc-scan", async (req, res) => {
  try {
    const {
      companyId,
      postSiteId,
      tourId,
      checkpointId,
      guardId,
      guardName,
      nfcTagValue,
      latitude,
      longitude,
    } = req.body;

    if (!companyId || !postSiteId || !tourId || !checkpointId || !guardId || !nfcTagValue) {
      return res.status(400).json({
        success: false,
        message: "Missing required NFC scan information.",
      });
    }

    const siteTour = await SiteTour.findOne({
      _id: tourId,
      companyId: String(companyId),
      postSiteId: String(postSiteId),
      isActive: true,
    });

    if (!siteTour) {
      return res.status(404).json({
        success: false,
        message: "Site tour not found.",
      });
    }

    const checkpoint = siteTour.checkpoints.id(checkpointId);

    if (!checkpoint) {
      return res.status(404).json({
        success: false,
        message: "Checkpoint not found for this tour.",
      });
    }

    if (checkpoint.nfcTagValue !== nfcTagValue) {
      return res.status(400).json({
        success: false,
        message: "Invalid NFC tag for this checkpoint.",
      });
    }

    const now = new Date();
    const schedule = getScheduleState(siteTour, now);
    if (!schedule.isScheduledToday) {
      return res.status(409).json({
        success: false,
        message: schedule.isExpired
          ? "No site tours scheduled. This tour duration has ended."
          : "This site tour is not scheduled for today.",
      });
    }

    const dateKey = getDateKey(now);
    let guardProgress = siteTour.progress.find((p) => p.dateKey === dateKey && String(p.guardId || "") === String(guardId));

    if (guardProgress && guardProgress.status === "Completed") {
      return res.status(409).json({
        success: false,
        message: "Site tour completed for today. Come back tomorrow.",
        completed: true,
      });
    }

    if (!guardProgress) {
      siteTour.progress.push({
        dateKey,
        guardId,
        guardName,
        startedAt: now,
        status: "In Progress",
        checkpointSnapshot: siteTour.checkpoints.map((item) => ({
          checkpointId: String(item._id),
          checkpointName: item.name,
          order: item.order,
        })),
        scannedCheckpoints: [],
      });

      guardProgress = siteTour.progress[siteTour.progress.length - 1];
    }

    const alreadyScanned = guardProgress.scannedCheckpoints.some(
      (item) => String(item.checkpointId) === String(checkpointId)
    );

    if (alreadyScanned) {
      return res.json({
        success: true,
        message: "Checkpoint already scanned.",
        completedCount: guardProgress.scannedCheckpoints.length,
        totalCount: siteTour.checkpoints.length,
        completed: guardProgress.status === "Completed",
      });
    }

    guardProgress.scannedCheckpoints.push({
      checkpointId: String(checkpoint._id),
      checkpointName: checkpoint.name,
      scannedAt: new Date(),
      qrCodeValue: "",
      nfcTagValue,
      scanType: "NFC",
      latitude: latitude || "",
      longitude: longitude || "",
    });

    if (guardProgress.scannedCheckpoints.length >= siteTour.checkpoints.length) {
      guardProgress.status = "Ready to Finish";
    } else {
      guardProgress.status = "In Progress";
    }

    await siteTour.save();

    return res.json({
      success: true,
      message:
        guardProgress.status === "Ready to Finish"
          ? "All NFC checkpoints scanned. Add a report if needed, then finish the tour."
          : "NFC checkpoint scanned successfully.",
      completedCount: guardProgress.scannedCheckpoints.length,
      totalCount: siteTour.checkpoints.length,
      completed: guardProgress.status === "Completed",
      readyToFinish: guardProgress.status === "Ready to Finish",
      checkpointName: checkpoint.name,
    });
  } catch (error) {
    console.error("NFC site tour scan error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error processing NFC checkpoint scan.",
    });
  }
});



// WEB + MOBILE: List active tours for a post site
app.get("/api/site-tours", async (req, res) => {
  try {
    const { companyId, postSiteId } = req.query;

    if (!companyId || !postSiteId) {
      return res.status(400).json({
        success: false,
        message: "companyId and postSiteId are required.",
      });
    }

    const tours = await SiteTour.find({
      companyId: String(companyId),
      postSiteId: String(postSiteId),
      isActive: true,
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      tours: tours.map((tour) => decorateTourForClient(tour)),
    });
  } catch (error) {
    console.error("Fetch site tours error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error fetching site tours.",
    });
  }
});

// MOBILE: Scan checkpoint QR code
app.post("/api/site-tours/scan", async (req, res) => {
  try {
    const {
      companyId,
      postSiteId,
      tourId,
      checkpointId,
      guardId,
      guardName,
      qrCodeValue,
      latitude,
      longitude,
    } = req.body;

    if (!companyId || !postSiteId || !tourId || !checkpointId || !guardId) {
      return res.status(400).json({
        success: false,
        message: "Missing required scan information.",
      });
    }

    const siteTour = await SiteTour.findOne({
      _id: tourId,
      companyId: String(companyId),
      postSiteId: String(postSiteId),
      isActive: true,
    });

    if (!siteTour) {
      return res.status(404).json({
        success: false,
        message: "Site tour not found.",
      });
    }

    const checkpoint = siteTour.checkpoints.id(checkpointId);

    if (!checkpoint) {
      return res.status(404).json({
        success: false,
        message: "Checkpoint not found for this tour.",
      });
    }

    if (checkpoint.qrCodeValue !== qrCodeValue) {
      return res.status(400).json({
        success: false,
        message: "Invalid QR tag for this checkpoint.",
      });
    }

    const now = new Date();
    const schedule = getScheduleState(siteTour, now);
    if (!schedule.isScheduledToday) {
      return res.status(409).json({
        success: false,
        message: schedule.isExpired
          ? "No site tours scheduled. This tour duration has ended."
          : "This site tour is not scheduled for today.",
      });
    }

    const dateKey = getDateKey(now);
    let guardProgress = siteTour.progress.find((p) => p.dateKey === dateKey && String(p.guardId || "") === String(guardId));

    if (guardProgress && guardProgress.status === "Completed") {
      return res.status(409).json({
        success: false,
        message: "Site tour completed for today. Come back tomorrow.",
        completed: true,
      });
    }

    if (!guardProgress) {
      siteTour.progress.push({
        dateKey,
        guardId,
        guardName,
        startedAt: now,
        status: "In Progress",
        checkpointSnapshot: siteTour.checkpoints.map((item) => ({
          checkpointId: String(item._id),
          checkpointName: item.name,
          order: item.order,
        })),
        scannedCheckpoints: [],
      });

      guardProgress = siteTour.progress[siteTour.progress.length - 1];
    }

    const alreadyScanned = guardProgress.scannedCheckpoints.some(
      (item) => String(item.checkpointId) === String(checkpointId)
    );

    if (alreadyScanned) {
      return res.status(200).json({
        success: true,
        message: "Checkpoint already scanned.",
        completedCount: guardProgress.scannedCheckpoints.length,
        totalCount: siteTour.checkpoints.length,
        completed: guardProgress.status === "Completed",
      });
    }

    guardProgress.scannedCheckpoints.push({
      checkpointId: String(checkpoint._id),
      checkpointName: checkpoint.name,
      scannedAt: new Date(),
      qrCodeValue,
      latitude: latitude || "",
      longitude: longitude || "",
    });

    if (guardProgress.scannedCheckpoints.length >= siteTour.checkpoints.length) {
      guardProgress.status = "Ready to Finish";
    } else {
      guardProgress.status = "In Progress";
    }

    await siteTour.save();

    return res.json({
      success: true,
      message:
        guardProgress.status === "Ready to Finish"
          ? "All checkpoints scanned. Finish the tour to save completion."
          : "Checkpoint scanned successfully.",
      completedCount: guardProgress.scannedCheckpoints.length,
      totalCount: siteTour.checkpoints.length,
      completed: guardProgress.status === "Completed",
      readyToFinish: guardProgress.status === "Ready to Finish",
      checkpointName: checkpoint.name,
    });
  } catch (error) {
    console.error("Site tour scan error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error processing checkpoint scan.",
    });
  }
});

// MOBILE: Finalize today's tour after every checkpoint has been scanned.
app.post("/api/site-tours/finish", async (req, res) => {
  try {
    const { companyId, postSiteId, tourId, guardId, guardName, comment, imageUrls } = req.body;
    if (!companyId || !postSiteId || !tourId || !guardId) {
      return res.status(400).json({ success: false, message: "Missing required tour completion information." });
    }

    const siteTour = await SiteTour.findOne({
      _id: tourId,
      companyId: String(companyId),
      postSiteId: String(postSiteId),
      isActive: true,
    }).lean();

    if (!siteTour) return res.status(404).json({ success: false, message: "Site tour not found." });
    const dateKey = getDateKey(new Date());
    const progress = (siteTour.progress || []).find((p) =>
      p.dateKey === dateKey && String(p.guardId || "") === String(guardId)
    );
    if (!progress) return res.status(409).json({ success: false, message: "Start and scan this tour before finishing it." });

    const scanned = Array.isArray(progress.scannedCheckpoints) ? progress.scannedCheckpoints.length : 0;
    const total = Array.isArray(siteTour.checkpoints) ? siteTour.checkpoints.length : 0;
    if (!total || scanned < total) {
      return res.status(409).json({ success: false, message: `Complete all checkpoints before finishing the tour (${scanned}/${total}).` });
    }
    if (progress.status === "Completed") {
      return res.status(409).json({ success: false, message: "Site tour is already completed for today." });
    }

    const completedAt = new Date();
    const images = Array.isArray(imageUrls) ? imageUrls.filter(Boolean).slice(0, 5) : [];
    // Use the native collection update so these additive completion fields are preserved
    // even when an older deployed SiteTour schema has not yet been expanded.
    const result = await SiteTour.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(tourId), companyId: String(companyId), postSiteId: String(postSiteId) },
      { $set: {
        "progress.$[p].status": "Completed",
        "progress.$[p].completedAt": completedAt,
        "progress.$[p].completionComment": String(comment || "").trim(),
        "progress.$[p].completionImages": images,
        "progress.$[p].finishedByGuardId": String(guardId),
        "progress.$[p].finishedByGuardName": String(guardName || "Guard"),
      } },
      { arrayFilters: [{ "p.dateKey": dateKey, "p.guardId": String(guardId) }] }
    );

    if (!result.modifiedCount) {
      return res.status(409).json({ success: false, message: "Unable to finalize this tour. Refresh and try again." });
    }
    return res.json({ success: true, message: "Site tour saved successfully.", completedAt });
  } catch (error) {
    console.error("Finish site tour error:", error);
    return res.status(500).json({ success: false, message: "Server error finishing site tour." });
  }
});

// WEB + MOBILE: Get one selected site tour
app.get("/api/site-tours/detail", async (req, res) => {
  try {
    const { companyId, postSiteId, tourId } = req.query;

    if (!companyId || !postSiteId || !tourId) {
      return res.status(400).json({
        success: false,
        message: "companyId, postSiteId, and tourId are required.",
      });
    }

    const siteTour = await SiteTour.findOne({
      _id: tourId,
      companyId: String(companyId),
      postSiteId: String(postSiteId),
      isActive: true,
    }).lean();

    if (!siteTour) {
      return res.status(404).json({
        success: false,
        message: "Site tour not found.",
      });
    }

    return res.status(200).json({
      success: true,
      siteTour: decorateTourForClient(siteTour),
    });
  } catch (error) {
    console.error("Fetch site tour detail error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error fetching site tour detail.",
    });
  }
});

// WEB: View site tours for a post site
app.get("/post-site/:postSiteId/site-tours", async (req, res) => {
  try {
    const { postSiteId } = req.params;
    const { companyId, postSiteName } = req.query;

    const tours = await SiteTour.find({
      companyId: String(companyId),
      postSiteId: String(postSiteId),
      isActive: true,
    })
      .sort({ createdAt: -1 })
      .lean();

    res.render("dashboard/site-tours", {
      tours,
      companyId,
      postSiteId,
      postSiteName,
      success: req.flash("success"),
      error: req.flash("error"),
    });
  } catch (error) {
    console.error("Site tours page error:", error);
    res.status(500).send("Server error loading site tours.");
  }
});

