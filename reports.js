const myModule = require('./index.js');
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const passport = require("passport");
const session = require("express-session");
const attachSubscription = require("./src/middleware/attachSubscription");
// const { requireActiveSubscription, requireFeature, requireNumericFeature  } = require("./src/middleware/requireSubscription");

const _ = require('lodash');
var companyInfo = require(__dirname + "/db/companyinfodb.js");
const { ObjectId } = require("mongodb");
const MobileReport = require("./src/models/report.js");
const ReportTemplate = require("./src/models/reportTemplate");
const { requireActiveSubscription, requireFeature, requireNumericFeature } = require("./src/middleware/requireSubscription");
const { isClientUser, getClientScope } = require("./src/utils/clientScope");


const app = myModule.main;
const User = myModule.userDB;
const Company = mongoose.model("Company", companyInfo);

// View Client Details.
// Rendering Client Edit

function notification(userName, userEmail, notType, notID) {
  const activity = {
    name: userName,
    email: userEmail,
    type: notType,
    activityId: notID
  };
  return activity;

}


app.post("/work-report", (req, res) => {
  console.log("I am linking here");
  const { clockId, workt, breakt, guardInfo, guardComp, startT, stopT, docId, shiftTemplateId, shiftTitle, shiftStartTime, shiftEndTime } = req.body;


  console.log("start time", startT,);
  console.log("User ID", guardInfo._id);
  console.log("IDID", docId);

  // console.log(guardComp);
  console.log("I AM ABOUT TO BE AUTHENTICATED");

  console.log("I AM AUTHENTICATED");


  Company.findById(guardInfo.assignedCompanyID).then((found) => {
    const clockReport = found.checkedReport.id(docId);
    console.log("ReportINFOIS", clockReport);

    function secondsFromDuration(value) {
      const str = String(value || "0:00:00");
      const parts = str.split(":");
      const h = parseInt(parts[0] || "0", 10);
      const m = parseInt(parts[1] || "0", 10);
      const sec = parseFloat(parts[2] || "0");
      return (h * 3600) + (m * 60) + sec;
    }

    function secondsFromTimeRange(start, end) {
      if (!start || !end) return 0;
      const s = String(start).split(":");
      const e = String(end).split(":");
      let startSec = (parseInt(s[0] || "0", 10) * 3600) + (parseInt(s[1] || "0", 10) * 60);
      let endSec = (parseInt(e[0] || "0", 10) * 3600) + (parseInt(e[1] || "0", 10) * 60);
      if (endSec < startSec) endSec += 86400;
      return endSec - startSec;
    }

    function formatSeconds(total) {
      total = Math.max(0, Math.floor(total || 0));
      const h = Math.floor(total / 3600);
      const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
      const sec = String(total % 60).padStart(2, "0");
      return `${h}:${m}:${sec}`;
    }

    const workedSeconds = secondsFromDuration(workt);
    const assignedSeconds = secondsFromTimeRange(shiftStartTime, shiftEndTime);
    const overtimeSeconds = assignedSeconds > 0 ? Math.max(0, workedSeconds - assignedSeconds) : 0;

    const timeInfo = { clockInTime: startT, clockOutTime: stopT, workTime: workt, breakTime: breakt, shiftTemplateId, shiftTitle, shiftStartTime, shiftEndTime, overtime: formatSeconds(overtimeSeconds), overtimeSeconds };
    clockReport.clock.push(timeInfo);

    const activity = notification(guardInfo.fullname, guardInfo.username, "Clock In", docId);
    activity.message = `${guardInfo.fullname} submitted time clock for ${shiftTitle || 'shift'}`;
    found.activity.push(activity);

    found.save();




    res.json({
      success: true,
      message: 'Time Info Added',
      guardID: guardInfo._id,
      companyInfo: found,
      // processedValue,
      // receivedAt: new Date().toISOString(),
    });

  }).catch((err) => {
    console.log(err);
    res.json({
      success: false,
      message: 'Company not found',
      // processedValue,
      // receivedAt: new Date().toISOString(),
    });

  });











})

async function findClientInfo(postID) {
  const fin = await Company.findOne(
    { "postSite._id": new ObjectId(postID) },
    { "postSite.$": 1 }
  );

  return fin;  // this returns the actual data
}

app.get("/func", async (req, res) => {
  const result = await findClientInfo();
  console.log(result);
  res.send(result);
});


app.post("/checking", (req, res) => {
  const { time, guardInfo, guardComp } = req.body;


  console.log(time, guardInfo.guardClients[0]._id);



  console.log("AUTHOK");
  Company.findById(guardInfo.assignedCompanyID).then(async (cFound) => {
    console.log("I Have Found the Company");

    const reportNew = {
      client: guardInfo.guardClients[0]._id, postSite: guardInfo.guardPostSite[0].postSiteID,
      guardName: guardInfo.fullname, guardId: guardInfo._id, checkIn: true, checkout: false,
      checkInTime: time
    };


    notification(guardInfo.fullname, guardInfo.username, "Check In",)
    console.log(reportNew);
    cFound.checkedReport.push(reportNew);
    const savedCompany = await cFound.save();
    console.log("After Pushing");

    // console.log(savedCompany);

    // console.log();
    // Get last added report
    const addedReport = savedCompany.checkedReport[savedCompany.checkedReport.length - 1];


    // Get its ID
    const newReportId = addedReport._id;
    const activity = notification(guardInfo.fullname, guardInfo.username, "Check In", newReportId);
    await cFound.activity.push(activity);
    cFound.save();

    console.log("New CheckedReport ID:", newReportId);



    // console.log(reportNew);
    res.json({
      success: true,
      message: 'Success for CheckediN',
      reportId: newReportId,
      // processedValue,
      // receivedAt: new Date().toISOString(),
    });


    // cFound.checkedReport.push(reportNew);
    // cFound.save();


  }).catch((err) => {
    res.json({
      success: false,
      message: 'Error for CheckediN',
      // processedValue,
      // receivedAt: new Date().toISOString(),
    });


  })


})

app.post("/checkingout", (req, res) => {

  const { dbId, guardInfo, checkouttime } = req.body;
  console.log("I am Cheking Out Now>>>>>");
  console.log(dbId, checkouttime);



  Company.findById(guardInfo.assignedCompanyID).then((cFound) => {
    const cReport = cFound.checkedReport.id(dbId);
    cReport.checkIn = false;
    cReport.checkOutTime = checkouttime;

    const activity = notification(guardInfo.fullname, guardInfo.username, "Check Out", dbId);
    cFound.activity.push(activity);
    // cFound.save();

    cFound.save();
    res.json({
      success: true,
      message: 'Successfully for CheckedOUT',
      // reportId: newReportId,
      // processedValue,
      // receivedAt: new Date().toISOString(),
    });


  }).catch((err) => {
    console.log("ERROR FINDING", err);
    res.json({
      success: true,
      message: 'Company Not Found!',
      // reportId: newReportId,
      // processedValue,
      // receivedAt: new Date().toISOString(),
    });

  })

})

app.get("/guard-report", (req, res) => {
  if (req.isAuthenticated()) {
    //  MobileReport.find({"companyID":req.user.assignedCompanyID}).then((report)=>{
    //   res.send(report);
    //  }).catch((err)=>{
    //   res.send(err);
    //  })

    res.render("dashboard/guard-report", { userInfo: req.user });
  } else {
    res.redirect("sign-in");
  }

  // res.render("dashboard/guard-report");
});


app.get("/my-report", requireActiveSubscription,
  requireNumericFeature("reportingDays", 1), async (req, res) => {
    if (req.isAuthenticated()) {
      let query = { companyID: req.user.assignedCompanyID };
      if (isClientUser(req.user)) {
        const { assignedPostSiteId } = await getClientScope(req.user);
        query["fields.postSiteId"] = assignedPostSiteId;
      }

      MobileReport.find(query).then((reporT) => {
        let incidentsCount = 0;
        let standardCount = 0;
        let generalCount = 0;
        let logCount = 0;
        let nfcCount = 0;
        reporT.forEach((rep) => {
          if (rep.category === "incident") incidentsCount++;
          else if (rep.category === "standard") standardCount++;
          else if (rep.category === "general") generalCount++;
          else if (rep.category === "log") logCount++;
          else if (rep.category === "nfc") nfcCount++;
        })

        res.render("dashboard/my-report", { userInfo: req.user, standardCount, incidentsCount, generalCount, logCount, nfcCount, reports: reporT });

      }).catch((err) => {
        res.send(err);
      })
    } else {
      res.redirect("sign-in");
    }
  });

async function findComandSite(companyId, postId) {
  const comF = await Company.findOne(
    { _id: companyId, "postSite._id": postId },
    { companyName: 1, postSite: { $elemMatch: { _id: postId } } }
  ).lean();
  console.log("my FOUNDED POST SITE IS", comF);


  return comF; // { companyName, postSite: [ ... ] } or null
}


function printer() {
  console.log("HELLO WORLD");

}


async function categoryReport(cate, req) {
  const query = {
    companyID: req.user.assignedCompanyID,
  };

  if (cate && cate !== "all") {
    query.category = cate;
  }

  if (isClientUser(req.user)) {
    const { assignedPostSiteId } = await getClientScope(req.user);

    if (!assignedPostSiteId) {
      return [];
    }

    query["fields.postSiteId"] = String(assignedPostSiteId);
  }

  console.log("REPORT CATEGORY QUERY:", query);

  const incidents = await MobileReport.find(query);

  const reports = await Promise.all(
    incidents.map(async (inc) => {
      const myCom = await findCompany(
        req.user.assignedCompanyID,
        inc.fields?.postSiteId
      );

      const clientName = myCom?.postSite?.[0]?.clientName || "Unknown";

      return {
        ...inc.toObject(),
        clientName,
      };
    })
  );

  return reports;
}

app.post("/reports-web", async (req, res) => {
  console.log("category is ", req.body.category);

  try {
    if (!req.isAuthenticated()) {
      return res.status(401).redirect("/sign-in");
    }

    const rawCategory = (req.body.category || "all").toString().trim().toLowerCase();

    let category = rawCategory;

    if (
      rawCategory === "all report" ||
      rawCategory === "all reports" ||
      rawCategory === "all_report" ||
      rawCategory === "all-reports"
    ) {
      category = "all";
    }

    const allowedCategories = ["incident", "general", "standard", "log", "nfc", "all"];

    if (!allowedCategories.includes(category)) {
      console.log("UNKNOWN REPORT CATEGORY:", rawCategory);

      return res.render("dashboard/guard-report", {
        userInfo: req.user,
        reports: [],
      });
    }

    const reports = await categoryReport(category, req);

    return res.render("dashboard/guard-report", {
      userInfo: req.user,
      reports,
    });
  } catch (err) {
    console.error("reports-web error:", err);
    return res.status(500).send("Server error");
  }
});


async function findCompany(compID, postSiteID) {
  console.log("i am inside function");

  const compInfo = await Company.findOne({ _id: compID, "postSite._id": postSiteID },
    { companyName: 1, postSite: { $elemMatch: { _id: postSiteID } } }
  ).then((comF) => {
    console.log("Company Info Are==>", comF);
    return comF;

    // res.render("dashboard/post-site-info", {
    //   userInfo: req.user,
    //   clientInfo: userFound, companyInfo: comF.postSite[0],
    //   fullCompInfo: comF
    // });
  });
  return compInfo;
}

app.post("/reports-view", (req, res) => {
  const reportInfo = req.body.reportId;
  console.log("report IDS", reportInfo);

  if (req.isAuthenticated()) {

    MobileReport.findById(reportInfo).then(async (singleReport) => {
      if (isClientUser(req.user)) {
        const { assignedPostSiteId } = await getClientScope(req.user);
        if (String(singleReport?.fields?.postSiteId || "") !== String(assignedPostSiteId || "")) {
          return res.status(403).send("Unauthorized");
        }
      }
      console.log('FOUNDED ID FOR POST SITE', singleReport.fields.postSiteId);

      const myCom = await findCompany(
        req.user.assignedCompanyID,
        singleReport.fields.postSiteId
      );

      // 🔥 Inject readable post site name into fields
      if (singleReport.fields?.postSiteId && myCom?.postSite?.[0]) {
        singleReport.fields.postSiteName = myCom.postSite[0].siteName;
      }
      console.log("My COMPUUUUUU", myCom);


      res.render("dashboard/view-report", { userInfo: req.user, reports: singleReport, companyInfo: myCom });
    }).catch((err) => {
      res.send(err);
    })
  }

})

// TESTER FAKE
app.get("/reports-viewss/:reportId", (req, res) => {
  const reportInfo = req.params.reportId;
  console.log("report IDS", reportInfo);

  if (req.isAuthenticated()) {

    MobileReport.findById(reportInfo).then(async (singleReport) => {
      if (isClientUser(req.user)) {
        const { assignedPostSiteId } = await getClientScope(req.user);
        if (String(singleReport?.fields?.postSiteId || "") !== String(assignedPostSiteId || "")) {
          return res.status(403).send("Unauthorized");
        }
      }
      console.log('FOUNDED ID FOR POST SITE', singleReport.fields.postSiteId);

      const myCom = await findCompany(req.user.assignedCompanyID, singleReport.fields.postSiteId);
      console.log("My COMPUUUUUU", myCom);


      res.render("dashboard/view-report", { userInfo: req.user, reports: singleReport, companyInfo: myCom });
    }).catch((err) => {
      res.send(err);
    })
  }

})

app.get("/approve-report/:id", async (req, res) => {
  try {
    if (!req.isAuthenticated()) return res.status(401).json({ ok: false, msg: "Not authenticated" });

    const result = await MobileReport.updateOne(
      { _id: req.params.id, companyID: req.user.assignedCompanyID },
      { $set: { status: true } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ ok: false, msg: "Report not found (or not in your company)" });
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, msg: "Server error" });
  }
});



// Rendering Web Checking Report.
app.get("/time-log", async (req, res) => {
  try {
    if (!req.isAuthenticated()) return res.redirect("/sign-in");

    const company = await Company.findById(req.user.assignedCompanyID).lean();
    if (!company) return res.status(404).send("Company not found");

    let postSites = company.postSite || [];
    let checkedReport = company.checkedReport || [];

    if (isClientUser(req.user)) {
      const { assignedPostSiteId } = await getClientScope(req.user);
      postSites = postSites.filter((ps) => String(ps._id) === String(assignedPostSiteId || ""));
      checkedReport = checkedReport.filter((log) => String(log.postSite || "") === String(assignedPostSiteId || ""));
    }

    // Build a lookup: postSiteId(string) -> postSite object
    const postSiteMap = new Map(
      postSites.map((ps) => [ps._id.toString(), ps])
    );

    // Enrich checkedReport by matching log.postSite (string) to postSite._id
    const timeLog = checkedReport.map((log) => {
      const postSiteRef = (log.postSite || "").toString(); // your field name is "postSite"
      const site = postSiteMap.get(postSiteRef) || null;

      return {
        ...log,
        postSiteInfo: site,                       // full site object
        clientName: site?.clientName || "Unknown" // easy access
      };
    });

    console.log("MY LOGSSS>>", timeLog);


    return res.render("dashboard/time-log", { userInfo: req.user, timeLog });
  } catch (err) {
    console.log("TIME LOG ERROR:", err);
    return res.status(500).send(err.toString());
  }
});


// CALANDER
app.get("/calender", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.redirect("/sign-in");
  }
  // res.send("work");
  // console.log("MY COM ID>>>", req.user.assignedCompanyID);



  Company.findById(req.user.assignedCompanyID).then(async (compF) => {
    // res.render("dashboard/calender", {userInfo:req.user});
    const postSite = compF.postSite;
    console.log(postSite);


    const clientUser = await User.find({ assignedCompanyID: req.user.assignedCompanyID, userType: "Client" });

    const mobileGuard = await User.find({ assignedCompanyID: req.user.assignedCompanyID, userType: "AmobileGuard" });


    res.render("dashboard/calender", { userInfo: req.user, clients: clientUser, guard: mobileGuard, post: postSite });

  }).catch((err) => {
    res.send(err);
  })


});


app.get("/report-template-web", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/sign-in");
  }
  // if (isClientUser(req.user)) {
  //   return res.redirect("/report-template-manager");
  // }
  res.render("dashboard/report-tem-add", { userInfo: req.user });



})


// 🔥 CREATE REPORT TEMPLATE (ADMIN)
//
app.post("/report-templates", async (req, res) => {
  try {
    // 🔐 Ensure user is logged in
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.redirect("/sign-in");
    }

    const user = req.user;
    // if (isClientUser(user)) {
    //   return res.status(403).send("Unauthorized");
    // }

    // 🔹 Extract form fields
    const {
      title,
      category,
      description,
      active,
      showFabMenu,
    } = req.body;

    let fields = req.body.fields || [];

    // 🔁 Normalize single field → array
    if (!Array.isArray(fields)) {
      fields = [fields];
    }

    // 🔥 Process fields properly
    const processedFields = fields.map((f, index) => {
      // 🔹 Convert options string → array
      let options = [];
      if (f.options && typeof f.options === "string") {
        options = f.options
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);
      }

      // 🔹 Generate clean keyName
      let keyName = (f.keyName || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");

      if (!keyName && f.label) {
        keyName = f.label
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_|_$/g, "");
      }

      return {
        label: (f.label || "").trim(),

        keyName: keyName,

        type: (f.type || "text").toLowerCase(),

        required: f.required === "true" || f.required === true,

        placeholder: f.placeholder || "",

        hint: f.placeholder || "",

        options: options,

        maxLength: f.maxLength ? parseInt(f.maxLength) : null,

        order: f.order ? parseInt(f.order) : index,
      };
    });

    // 🔥 Basic validation
    if (!title || processedFields.length === 0) {
      return res.status(400).send("Title and at least one field are required.");
    }

    // 🔹 Save to database
    const template = await ReportTemplate.create({
      companyID: user.assignedCompanyID,
      title: title.trim(),
      category: category || "general",
      description: description || "",
      active: active !== "false",
      showFabMenu: showFabMenu !== "false",
      createdBy: user._id.toString(),
      fields: processedFields,
    });

    console.log("✅ Template created:", template._id);

    // 🔁 Redirect after success
    return res.redirect("/report-template-manager");

  } catch (err) {
    console.error("❌ Error creating template:", err);

    // Duplicate template name
    if (err.code === 11000) {
      return res.status(400).send("A template with this name already exists.");
    }

    return res.status(500).send("Server error creating template.");
  }
});


// View Template

app.get("/report-template-manager", async (req, res) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.redirect("/sign-in");
    }

    const templates = await ReportTemplate.find({
      companyID: req.user.assignedCompanyID
    }).sort({ createdAt: -1 });

    return res.render("dashboard/report-tem-manager", {
      userInfo: req.user,
      templates
    });
  } catch (err) {
    console.error("Error loading template manager:", err);
    return res.status(500).send("Server error loading templates.");
  }
});


// Edit Template

app.get("/report-template-edit/:id", async (req, res) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.redirect("/sign-in");
    }
    if (isClientUser(req.user)) {
      return res.redirect("/report-template-manager");
    }

    const template = await ReportTemplate.findOne({
      _id: req.params.id,
      companyID: req.user.assignedCompanyID
    });

    if (!template) {
      return res.status(404).send("Template not found.");
    }

    return res.render("dashboard/report-tem-edit", {
      userInfo: req.user,
      template
    });
  } catch (err) {
    console.error("Error loading edit template:", err);
    return res.status(500).send("Server error loading edit template.");
  }
});

// Delete Template
app.post("/report-template-delete/:id", async (req, res) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.redirect("/sign-in");
    }

    await ReportTemplate.findOneAndDelete({
      _id: req.params.id,
      companyID: req.user.assignedCompanyID
    });

    return res.redirect("/report-template-manager");
  } catch (err) {
    console.error("Error deleting template:", err);
    return res.status(500).send("Server error deleting template.");
  }
});


// 🔥 UPDATE REPORT TEMPLATE
app.post("/report-template-update/:id", async (req, res) => {
  try {
    // 🔐 Ensure user is authenticated
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.redirect("/sign-in");
    }

    const user = req.user;

    // 🔹 Extract main fields
    const {
      title,
      category,
      description,
      active,
      showFabMenu
    } = req.body;

    let fields = req.body.fields || [];

    // 🔁 Normalize (single field → array)
    if (!Array.isArray(fields)) {
      fields = [fields];
    }

    // 🔥 Process fields
    const processedFields = fields.map((f, index) => {
      // Convert options string → array
      let options = [];
      if (f.options && typeof f.options === "string") {
        options = f.options
          .split(",")
          .map(v => v.trim())
          .filter(Boolean);
      }

      // Generate keyName if needed
      let keyName = (f.keyName || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");

      if (!keyName && f.label) {
        keyName = f.label
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_|_$/g, "");
      }

      return {
        label: (f.label || "").trim(),

        keyName: keyName,

        type: (f.type || "text").toLowerCase(),

        required: f.required === "true" || f.required === true,

        placeholder: f.placeholder || "",

        hint: f.placeholder || "",

        options: options,

        maxLength: f.maxLength ? parseInt(f.maxLength) : null,

        order: f.order ? parseInt(f.order) : index
      };
    });

    // 🔥 Validation
    if (!title || processedFields.length === 0) {
      return res.status(400).send("Title and at least one field are required.");
    }

    // 🔹 Update in DB (with company security)
    const updated = await ReportTemplate.findOneAndUpdate(
      {
        _id: req.params.id,
        companyID: user.assignedCompanyID
      },
      {
        title: title.trim(),
        category: category || "general",
        description: description || "",
        active: active !== "false",
        showFabMenu: showFabMenu !== "false",
        fields: processedFields
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).send("Template not found or unauthorized.");
    }

    console.log("✅ Template updated:", updated._id);

    // 🔁 Redirect back to manager
    return res.redirect("/report-template-manager");

  } catch (err) {
    console.error("❌ Error updating template:", err);

    if (err.code === 11000) {
      return res.status(400).send("A template with this name already exists.");
    }

    return res.status(500).send("Server error updating template.");
  }
});


// ROUTE FOR MOBILE MOBILE--MOBILE--MOBILE MOBILE--MOBILE--MOBILE
// MOBILE--MOBILE--MOBILE MOBILE--MOBILE--MOBILE MOBILE--MOBILE--MOBILE
app.get("/report-templates", async (req, res) => {
  try {
    const companyId = (req.query.companyId || "").toString().trim();

    if (!companyId) {
      return res.status(400).json({ error: "companyId is required" });
    }

    const items = await ReportTemplate.find({
      companyID: companyId,
      active: true,
    }).sort({ title: 1 });

    return res.json({ ok: true, items });
  } catch (err) {
    console.error("List report templates error:", err);
    return res.status(500).json({ error: "Server error listing templates" });
  }
});

app.get("/report-templates/:id", async (req, res) => {
  try {
    const companyId = (req.query.companyId || "").toString().trim();

    if (!companyId) {
      return res.status(400).json({ error: "companyId is required" });
    }

    const template = await ReportTemplate.findOne({
      _id: req.params.id,
      companyID: companyId,
      active: true,
    });

    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    return res.json({ ok: true, template });
  } catch (err) {
    console.error("Get report template error:", err);
    return res.status(500).json({ error: "Server error fetching template" });
  }
});

