const myModule = require("./index.js");
const mongoose = require("mongoose");
const CalendarEvent = require("./src/models/CalendarEvents");

const app = myModule.main;

app.get("/api/mobile/events", async (req, res) => {
  try {
    const { companyId, guardId, postSiteIds, startDate, endDate } = req.query;

    if (!companyId || !guardId) {
      return res.status(400).json({
        success: false,
        message: "companyId and guardId are required.",
      });
    }

    const query = {
      companyId: String(companyId),
      assignedTo: String(guardId),
    };

    if (postSiteIds) {
      const siteIds = String(postSiteIds)
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);

      if (siteIds.length > 0) {
        query.postSiteId = { $in: siteIds };
      }
    }

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

    const events = await CalendarEvent.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      events,
    });
  } catch (err) {
    console.error("Mobile events error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error loading events.",
    });
  }
});

module.exports = app;