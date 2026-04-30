const myModule = require("./index.js");
const Visitor = require("./src/models/Visitor");

const app = myModule.main;

// MOBILE + WEB: GET VISITORS BY POST SITE
app.get("/api/visitors", async (req, res) => {
  try {
    const { companyId, postSiteId, startDate, endDate } = req.query;

    const filter = {};

    if (companyId) filter.companyId = companyId;
    if (postSiteId) filter.postSiteId = postSiteId;

    if (startDate && endDate) {
      filter.visitDateTime = {
        $gte: new Date(startDate),
        $lt: new Date(endDate)
      };
    }

    const visitors = await Visitor.find(filter).sort({ visitDateTime: -1 });

    res.json({
      success: true,
      visitors
    });

  } catch (err) {
    console.log("Fetch visitors error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch visitors"
    });
  }
});

// MOBILE: CREATE VISITOR
app.post("/api/visitors/create", async (req, res) => {
  try {
    console.log("VISITOR BODY:", req.body);

    const visitor = new Visitor({
      companyId: req.body.companyId || "",

      postSiteId: req.body.postSiteId || "",
      postSiteName: req.body.postSiteName || "",

      guardId: req.body.guardId || "",
      guardName: req.body.guardName || "",

      visitorName: req.body.visitorName || "",
      sex: req.body.sex || "",
      phoneNumber: req.body.phoneNumber || "",
      email: req.body.email || "",
      purposeOfVisit: req.body.purposeOfVisit || "",
      firstTimeVisiting:
        req.body.firstTimeVisiting === true ||
        req.body.firstTimeVisiting === "true",

      visitDateTime: new Date(),

      visitorFace: req.body.visitorFace || {},
      visitorIdCard: req.body.visitorIdCard || {},
      signature: req.body.signature || {},
    });

    await visitor.save();

    res.json({
      success: true,
      message: "Visitor saved successfully",
      visitor
    });

  } catch (err) {
    console.log("Create visitor error:", err);

    res.status(500).json({
      success: false,
      message: err.message || "Failed to save visitor"
    });
  }
});

