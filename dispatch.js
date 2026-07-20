const myModule = require("./index.js");
const { requirePremiumWebFeature } = require("./src/middleware/requirePremiumWebFeature");
const mongoose = require("mongoose");
const Note = require("./src/models/note.js");
const Dispatch = require("./src/models/Dispatch");
// const Dispatch = require("./src/models/Dispatch");

const app = myModule.main;
const User = myModule.userDB;
const { isClientUser, getClientScope } = require("./src/utils/clientScope");

// CREATE DISPATCH
app.post("/api/dispatch/create", async (req, res) => {
  try {

    const raw = Date.now().toString();
const ticketId = "DSP-" + raw.slice(4);
    // const ticketId = "DSP-" + Date.now();

    const dispatch = new Dispatch({
      ...req.body,
      ticketId,
      status: "Pending"
    });

    await dispatch.save();

    res.json({
      success: true,
      message: "Dispatch created successfully",
      dispatch
    });
  } catch (error) {
    console.error("Create dispatch error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create dispatch"
    });
  }
});

// GET DISPATCH LIST BY COMPANY
app.get("/api/dispatch/list/:companyId", async (req, res) => {
  try {
    const data = await Dispatch.find({
      companyId: req.params.companyId
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      dispatchList: data
    });
  } catch (error) {
    console.error("Fetch dispatch list error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dispatch list"
    });
  }
});

// ACCEPT DISPATCH
app.post("/api/dispatch/accept/:id", async (req, res) => {
  try {
    const dispatch = await Dispatch.findById(req.params.id);

    if (!dispatch) {
      return res.status(404).json({
        success: false,
        message: "Dispatch not found"
      });
    }

    dispatch.status = "Accepted";
    dispatch.acceptedBy = req.body.guardId || "";
    dispatch.acceptedAt = new Date();

    await dispatch.save();

    res.json({
      success: true,
      message: "Dispatch accepted successfully",
      dispatch
    });
  } catch (error) {
    console.error("Accept dispatch error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to accept dispatch"
    });
  }
});

// UPDATE DISPATCH
app.post("/api/dispatch/update/:id", async (req, res) => {
  try {
    const dispatch = await Dispatch.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!dispatch) {
      return res.status(404).json({
        success: false,
        message: "Dispatch not found"
      });
    }

    res.json({
      success: true,
      message: "Dispatch updated successfully",
      dispatch
    });
  } catch (error) {
    console.error("Update dispatch error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update dispatch"
    });
  }
});

app.get("/dispatch", requirePremiumWebFeature("Dispatch"), async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect("/sign-in");
    }

    const companyId = req.user.assignedCompanyID;

    const dispatchQuery = { companyId: String(companyId) };
    if (isClientUser(req.user)) {
      const { assignedPostSiteIds } = await getClientScope(req.user);
      dispatchQuery.postSiteId = { $in: assignedPostSiteIds };
    }
    const dispatchList = await Dispatch.find(dispatchQuery).sort({ createdAt: -1 });

    res.render("dashboard/dispatch", {
      userInfo: req.user,
      user: req.user,
      dispatchList
    });

  } catch (err) {
    console.log(err);
    res.redirect("/dashboard");
  }
});

app.get("/new-dispatch", requirePremiumWebFeature("Dispatch"), async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect("/sign-in");
    }

    const companyId = req.user.assignedCompanyID;

    const Company = mongoose.model("Company");
    const company = await Company.findById(companyId);

    let clientQuery = { assignedCompanyID: companyId, userType: "Client" };
    let guardQuery = { assignedCompanyID: companyId, userType: "AmobileGuard" };
    let postSites = company && company.postSite ? company.postSite : [];
    if (isClientUser(req.user)) {
      const { assignedPostSiteIds, allowedClientIds } = await getClientScope(req.user);
      clientQuery._id = { $in: allowedClientIds };
      guardQuery.guardPostSite = { $elemMatch: { postSiteID: { $in: assignedPostSiteIds } } };
      postSites = postSites.filter((site) => assignedPostSiteIds.includes(String(site._id)));
    }
    const clients = await User.find(clientQuery);
    const guards = await User.find(guardQuery);

    res.render("dashboard/new-dispatch", {
      userInfo: req.user,
      user: req.user,
      clients,
      guards,
      postSites,
      dispatchInfo: null
    });

  } catch (err) {
    console.log(err);
    res.redirect("/dispatch");
  }
});

app.get("/edit-dispatch/:id", requirePremiumWebFeature("Dispatch"), async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect("/sign-in");
    }

    const companyId = req.user.assignedCompanyID;

    const dispatchInfo = await Dispatch.findById(req.params.id);

    if (!dispatchInfo) {
      return res.redirect("/dispatch");
    }

    const Company = mongoose.model("Company");
    const company = await Company.findById(companyId);

    const clients = await User.find({
      assignedCompanyID: companyId,
      userType: "Client"
    });

    const guards = await User.find({
      assignedCompanyID: companyId,
      userType: "AmobileGuard"
    });

    const postSites = company && company.postSite ? company.postSite : [];

    res.render("dashboard/new-dispatch", {
      userInfo: req.user,
      user: req.user,
      clients,
      guards,
      postSites,
      dispatchInfo
    });

  } catch (err) {
    console.log(err);
    res.redirect("/dispatch");
  }
});

app.post("/create-dispatch", async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect("/sign-in");
    }

    console.log("DISPATCH BODY:", req.body);

    const clientInfo = req.body.clientInfo || "";
    const postSiteInfo = req.body.postSiteInfo || "";
    const guardInfo = req.body.guardInfo || "";

    const [clientId, clientName] = clientInfo.includes("&")
      ? clientInfo.split("&")
      : ["", ""];

    const [postSiteId, postSiteName] = postSiteInfo.includes("&")
      ? postSiteInfo.split("&")
      : ["", ""];

    const [guardId, guardName] = guardInfo.includes("&")
      ? guardInfo.split("&")
      : ["", ""];

    const ticketId = "DSP-" + Date.now();

    const dispatch = new Dispatch({
      ticketId,
      companyId: req.user.assignedCompanyID,

      clientId,
      clientName,

      postSiteId,
      postSiteName,

      guardId,
      guardName,

      priority: req.body.priority || "",
      callerType: req.body.callerType || "",
      callerName: req.body.callerName || "",

      incidentLocation: req.body.incidentLocation || "",
      incidentType: req.body.incidentType || "",
      incidentDateTime: req.body.incidentDateTime || null,

      incidentDetails: req.body.incidentDetails || "",
      actionTaken: req.body.actionTaken || "",
      internalNotes: req.body.internalNotes || "",

      status: "Pending"
    });

    await dispatch.save();

    res.redirect("/dispatch");

  } catch (err) {
    console.log("Create dispatch error:", err);
    res.redirect("/new-dispatch");
  }
});


app.post("/update-dispatch", async (req, res) => {


    console.log("HOLD ME TIGHT", req.body.callerName);
    
  try {
    const Dispatch = require("./src/models/Dispatch");

    const [clientId, clientName] = req.body.clientInfo.split("&");
    const [postSiteId, postSiteName] = req.body.postSiteInfo.split("&");
    const [guardId, guardName] = req.body.guardInfo
      ? req.body.guardInfo.split("&")
      : ["", ""];

    await Dispatch.findByIdAndUpdate(req.body.dispatchId, {
      clientId,
      clientName,

      postSiteId,
      postSiteName,

      guardId,
      guardName,

      priority: req.body.priority,
      callerType: req.body.callerType,
      callerName: req.body.callerName || "",

      incidentLocation: req.body.incidentLocation,
      incidentType: req.body.incidentType,
      incidentDateTime: req.body.incidentDateTime,

      incidentDetails: req.body.incidentDetails,
      actionTaken: req.body.actionTaken,
      internalNotes: req.body.internalNotes
    });

    res.redirect("/dispatch");

  } catch (err) {
    console.log(err);
    res.redirect("/dispatch");
  }
});

app.post("/api/dispatch/:id/attachments", async (req, res) => {
  try {
    const {
      kind,
      publicId,
      secureUrl,
      resourceType,
      format,
      bytes,
      originalName
    } = req.body;

    if (!kind || !publicId || !secureUrl) {
      return res.status(400).json({
        success: false,
        message: "Missing attachment fields"
      });
    }

    const dispatch = await Dispatch.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          attachments: {
            kind,
            publicId,
            secureUrl,
            resourceType,
            format,
            bytes,
            originalName
          }
        }
      },
      { new: true }
    );

    res.json({
      success: true,
      dispatch
    });
  } catch (err) {
    console.error("Dispatch attachment error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to save dispatch attachment"
    });
  }
});

// MOBILE: GET DISPATCH ASSIGNED TO GUARD
app.get("/api/mobile/dispatch", async (req, res) => {
  try {
    const { companyId, guardId, startDate, endDate } = req.query;

    if (!companyId || !guardId) {
      return res.status(400).json({
        success: false,
        message: "companyId and guardId are required"
      });
    }

    const filter = {
      companyId: companyId,
      guardId: guardId
    };

    if (startDate && endDate) {
      filter.incidentDateTime = {
        $gte: new Date(startDate),
        $lt: new Date(endDate)
      };
    }

    const dispatchList = await Dispatch.find(filter).sort({ createdAt: -1 });

    res.json({
      success: true,
      dispatchList
    });

  } catch (err) {
    console.log("Mobile dispatch list error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dispatch list"
    });
  }
});