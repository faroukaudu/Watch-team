const myModule = require("./index.js");
const app = myModule.main;

const WatchMode = require("./src/models/WatchMode");

// MOBILE: submit watch mode video
app.post("/api/watchmode/create", async (req, res) => {
  try {
    const {
      companyId,
      guardId,
      guardName,
      videoUrl,
      publicId,
      duration,
      note,
    } = req.body;

    if (!companyId || !guardId || !videoUrl) {
      return res.status(400).json({
        success: false,
        message: "companyId, guardId, and videoUrl are required.",
      });
    }

    const watchMode = await WatchMode.create({
      companyId: String(companyId),
      guardId: String(guardId),
      guardName: guardName || "Guard",
      videoUrl,
      publicId: publicId || "",
      duration: duration || null,
      note: note || "",
    });

    return res.status(201).json({
      success: true,
      message: "WatchMode video submitted successfully.",
      watchMode,
    });
  } catch (error) {
    console.error("WatchMode create error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error submitting WatchMode video.",
    });
  }
});

// WEB: WatchMode page
app.get("/watchmode", async (req, res) => {
  try {
    if (!req.isAuthenticated()) return res.redirect("/sign-in");

    const companyId =
      req.user && req.user.assignedCompanyID
        ? String(req.user.assignedCompanyID)
        : "";

    const watchModes = await WatchMode.find({ companyId })
      .sort({ createdAt: -1 })
      .lean();

    res.render("dashboard/watchmode", {
      userInfo: req.user,
      watchModes,
    });
  } catch (error) {
    console.error("WatchMode page error:", error);
    res.status(500).send("Server error loading WatchMode.");
  }
});

app.get("/api/watchmode/my-videos", async (req, res) => {
  try {
    const { companyId, guardId } = req.query;

    if (!companyId || !guardId) {
      return res.status(400).json({
        success: false,
        message: "companyId and guardId are required",
      });
    }

    const watchModes = await WatchMode.find({
      companyId: String(companyId),
      guardId: String(guardId),
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      watchModes,
    });
  } catch (error) {
    console.error("WatchMode my videos error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error loading WatchMode videos",
    });
  }
});