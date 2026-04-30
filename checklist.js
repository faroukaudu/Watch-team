const myModule = require("./index.js");
const mongoose = require("mongoose");
const Checklist = require("./src/models/Checklist");

const app = myModule.main;
const User = myModule.userDB;

// WEB: CREATE CHECKLIST
app.post("/create-checklist", async (req, res) => {
  try {
    if (!req.user) return res.redirect("/sign-in");

    const {
      postSiteId,
      postSiteName,
      name,
      description,
      assignedGuards,
      checklistItems
    } = req.body;

    const guardsArray = Array.isArray(assignedGuards)
      ? assignedGuards
      : assignedGuards
        ? [assignedGuards]
        : [];

    const itemsArray = Array.isArray(checklistItems)
      ? checklistItems
      : checklistItems
        ? [checklistItems]
        : [];

    const selectedGuards = guardsArray.map((g) => {
      const [guardId, guardName, guardEmail] = g.split("&");
      return { guardId, guardName, guardEmail };
    });

    const checklist = new Checklist({
      companyId: req.user.assignedCompanyID,

      postSiteId,
      postSiteName,

      name,
      description,

      addedById: req.user._id,
      addedByName: req.user.fullname,
      addedByUserType: req.user.userType,

      assignedGuards: selectedGuards,

      items: itemsArray
        .filter(item => item && item.trim() !== "")
        .map(item => ({ text: item.trim() })),

      progress: selectedGuards.map(g => ({
        guardId: g.guardId,
        checkedItems: [],
        completed: false
      }))
    });

    await checklist.save();

    res.redirect("back");

  } catch (err) {
    console.log("Create checklist error:", err);
    res.redirect("back");
  }
});

// WEB: UPDATE CHECKLIST
app.post("/update-checklist", async (req, res) => {
  try {
    if (!req.user) return res.redirect("/sign-in");

    const {
      checklistId,
      name,
      description,
      assignedGuards,
      checklistItems
    } = req.body;

    const guardsArray = Array.isArray(assignedGuards)
      ? assignedGuards
      : assignedGuards
        ? [assignedGuards]
        : [];

    const itemsArray = Array.isArray(checklistItems)
      ? checklistItems
      : checklistItems
        ? [checklistItems]
        : [];

    const selectedGuards = guardsArray.map((g) => {
      const [guardId, guardName, guardEmail] = g.split("&");
      return { guardId, guardName, guardEmail };
    });

    const oldChecklist = await Checklist.findById(checklistId);

    const oldProgress = oldChecklist.progress || [];

    const newProgress = selectedGuards.map(g => {
      const existing = oldProgress.find(p => p.guardId === g.guardId);

      return existing || {
        guardId: g.guardId,
        checkedItems: [],
        completed: false
      };
    });

    await Checklist.findByIdAndUpdate(checklistId, {
      name,
      description,
      assignedGuards: selectedGuards,
      items: itemsArray
        .filter(item => item && item.trim() !== "")
        .map(item => ({ text: item.trim() })),
      progress: newProgress
    });

    res.redirect("back");

  } catch (err) {
    console.log("Update checklist error:", err);
    res.redirect("back");
  }
});

// WEB + MOBILE: GET CHECKLISTS BY POST SITE
app.get("/api/checklists", async (req, res) => {
  try {
    const { companyId, postSiteId, guardId, startDate, endDate } = req.query;

    const filter = {};

    if (companyId) filter.companyId = String(companyId);
    if (postSiteId) filter.postSiteId = String(postSiteId);

    if (guardId) {
      filter["assignedGuards.guardId"] = String(guardId);
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        filter.createdAt = {
          $gte: start,
          $lt: end
        };
      }
    }

    const checklists = await Checklist.find(filter).sort({ createdAt: -1 });

    res.json({
      success: true,
      checklists
    });

  } catch (err) {
    console.log("Fetch checklist error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch checklists"
    });
  }
});

// MOBILE: SAVE CHECKED ITEM
app.post("/api/checklists/:id/check-item", async (req, res) => {
  try {
    const { guardId, itemIndex, checked } = req.body;

    const checklist = await Checklist.findById(req.params.id);

    if (!checklist) {
      return res.status(404).json({
        success: false,
        message: "Checklist not found"
      });
    }

    let progress = checklist.progress.find(p => p.guardId === guardId);

    if (!progress) {
      checklist.progress.push({
        guardId,
        checkedItems: [],
        completed: false
      });

      progress = checklist.progress[checklist.progress.length - 1];
    }

    const indexNumber = Number(itemIndex);

    if (checked === true || checked === "true") {
      if (!progress.checkedItems.includes(indexNumber)) {
        progress.checkedItems.push(indexNumber);
      }
    } else {
      progress.checkedItems = progress.checkedItems.filter(i => i !== indexNumber);
    }

    progress.completed = progress.checkedItems.length === checklist.items.length;
    progress.completedAt = progress.completed ? new Date() : null;
    progress.updatedAt = new Date();

    await checklist.save();

    res.json({
      success: true,
      checklist
    });

  } catch (err) {
    console.log("Check item error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update checklist item"
    });
  }
});

// MOBILE: COMPLETE CHECKLIST
app.post("/api/checklists/:id/complete", async (req, res) => {
  try {
    const { guardId } = req.body;

    const checklist = await Checklist.findById(req.params.id);

    if (!checklist) {
      return res.status(404).json({
        success: false,
        message: "Checklist not found"
      });
    }

    const progress = checklist.progress.find(p => p.guardId === guardId);

    if (!progress || progress.checkedItems.length !== checklist.items.length) {
      return res.status(400).json({
        success: false,
        message: "All checklist items must be checked first"
      });
    }

    progress.completed = true;
    progress.completedAt = new Date();
    progress.updatedAt = new Date();

    await checklist.save();

    res.json({
      success: true,
      checklist
    });

  } catch (err) {
    console.log("Complete checklist error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to complete checklist"
    });
  }
});