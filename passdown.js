const myModule = require("./index.js");
const app = myModule.main;

const Passdown = require("./src/models/Passdown");

// MOBILE + WEB: Create Passdown
app.post("/api/passdowns/create", async (req, res) => {
  try {
    const {
      companyId,
      postSiteId,
      postSiteName,
      guardId,
      guardName,
      title,
      message,
      priority,
      visibility,
    } = req.body;

    if (!companyId || !postSiteId || !guardId || !message) {
      return res.status(400).json({
        success: false,
        message: "companyId, postSiteId, guardId, and message are required.",
      });
    }

    const passdown = await Passdown.create({
      companyId: String(companyId),
      postSiteId: String(postSiteId),
      postSiteName: postSiteName || "",
      guardId: String(guardId),
      guardName: guardName || "",
      title: title || "Passdown Note",
      message,
      priority: priority || "Normal",
      visibility: visibility || "All Guards",
    });

    return res.status(201).json({
      success: true,
      message: "Passdown created successfully.",
      passdown,
    });
  } catch (error) {
    console.error("Create passdown error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error creating passdown.",
    });
  }
});

// MOBILE + WEB: List passdowns for post site
app.get("/api/passdowns", async (req, res) => {
  try {
    const { companyId, postSiteId } = req.query;

    if (!companyId || !postSiteId) {
      return res.status(400).json({
        success: false,
        message: "companyId and postSiteId are required.",
      });
    }

    const passdowns = await Passdown.find({
      companyId: String(companyId),
      postSiteId: String(postSiteId),
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      passdowns,
    });
  } catch (error) {
    console.error("Fetch passdowns error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error fetching passdowns.",
    });
  }
});

// MOBILE: mark passdown as read
app.post("/api/passdowns/read", async (req, res) => {
  try {
    const { passdownId, guardId, guardName } = req.body;

    if (!passdownId || !guardId) {
      return res.status(400).json({
        success: false,
        message: "passdownId and guardId are required.",
      });
    }

    const passdown = await Passdown.findById(passdownId);

    if (!passdown) {
      return res.status(404).json({
        success: false,
        message: "Passdown not found.",
      });
    }

    const alreadyRead = passdown.readBy.some(
      (item) => String(item.guardId) === String(guardId)
    );

    if (!alreadyRead) {
      passdown.readBy.push({
        guardId,
        guardName: guardName || "",
        readAt: new Date(),
      });

      await passdown.save();
    }

    return res.status(200).json({
      success: true,
      message: "Passdown marked as read.",
    });
  } catch (error) {
    console.error("Read passdown error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error marking passdown as read.",
    });
  }
});

// WEB: close passdown
app.post("/api/passdowns/close", async (req, res) => {
  try {
    const { passdownId } = req.body;

    await Passdown.findByIdAndUpdate(passdownId, {
      status: "Closed",
    });

    return res.status(200).json({
      success: true,
      message: "Passdown closed successfully.",
    });
  } catch (error) {
    console.error("Close passdown error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error closing passdown.",
    });
  }
});

app.get("/passdowns", async (req, res) => {
  try {
    const companyId =
      req.user && req.user.assignedCompanyID
        ? String(req.user.assignedCompanyID)
        : "";

    const passdowns = await Passdown.find({
      companyId: companyId,
    })
      .sort({ createdAt: -1 })
      .lean();

    res.render("dashboard/passdowns", {
      userInfo: req.user,
      passdowns,
    });
  } catch (error) {
    console.error("Passdown page error:", error);
    res.status(500).send("Server error loading passdowns.");
  }
});