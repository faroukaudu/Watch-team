const myModule = require("./index.js");
const mongoose = require("mongoose");
const Note = require("./src/models/note.js");

const app = myModule.main;
const User = myModule.userDB;

// Mobile/API: Create note
app.post("/api/notes", async (req, res) => {
  try {
    const {
      companyID,
      postSiteID,
      postSiteName,
      guardID,
      guardName,
      title,
      note,
    } = req.body;

    if (!companyID || !postSiteID || !guardID || !guardName || !title || !note) {
      return res.status(400).json({
        success: false,
        message: "companyID, postSiteID, guardID, guardName, title, and note are required.",
      });
    }

    const createdNote = await Note.create({
      companyID: String(companyID),
      postSiteID: String(postSiteID),
      postSiteName: postSiteName || "",
      guardID: String(guardID),
      guardName,
      title,
      note,
    });

    return res.json({
      success: true,
      message: "Note submitted successfully.",
      note: createdNote,
    });
  } catch (err) {
    console.error("Create note error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error creating note.",
    });
  }
});

// Web/API: Get notes by post site
app.get("/api/notes/post-site/:postSiteID", async (req, res) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const postSiteID = req.params.postSiteID;

    const query = {
      postSiteID: String(postSiteID),
      companyID: String(req.user.assignedCompanyID),
    };

    const notes = await Note.find(query).sort({ createdAt: -1 }).lean();

    return res.json({
      success: true,
      notes,
    });
  } catch (err) {
    console.error("Fetch notes error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error fetching notes.",
    });
  }
});


// Mobile/API: Get notes posted by a guard
app.get("/api/notes/guard/:guardID", async (req, res) => {
  try {
    const { guardID } = req.params;
    const { companyID, startDate, endDate } = req.query;

    if (!guardID || !companyID) {
      return res.status(400).json({
        success: false,
        message: "guardID and companyID are required.",
      });
    }

    const query = {
      guardID: String(guardID),
      companyID: String(companyID),
    };

    if (startDate || endDate) {
      query.createdAt = {};

      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }

      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const notes = await Note.find(query).sort({ createdAt: -1 }).lean();

    return res.json({
      success: true,
      notes,
    });
  } catch (err) {
    console.error("Fetch guard notes error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error fetching guard notes.",
    });
  }
});


// Mobile/API: Get single note
app.get("/api/notes/:noteID", async (req, res) => {
  try {
    const note = await Note.findById(req.params.noteID).lean();

    if (!note) {
      return res.status(404).json({
        success: false,
        message: "Note not found.",
      });
    }

    return res.json({
      success: true,
      note,
    });
  } catch (err) {
    console.error("Fetch single note error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error fetching note.",
    });
  }
});


// Mobile/API: Update note
app.put("/api/notes/:noteID", async (req, res) => {
  try {
    const { title, note } = req.body;

    if (!title || !note) {
      return res.status(400).json({
        success: false,
        message: "Title and note are required.",
      });
    }

    const updatedNote = await Note.findByIdAndUpdate(
      req.params.noteID,
      {
        title: title.trim(),
        note: note.trim(),
      },
      { new: true }
    );

    if (!updatedNote) {
      return res.status(404).json({
        success: false,
        message: "Note not found.",
      });
    }

    return res.json({
      success: true,
      message: "Note updated successfully.",
      note: updatedNote,
    });
  } catch (err) {
    console.error("Update note error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error updating note.",
    });
  }
});

module.exports = app;