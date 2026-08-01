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



function getActiveGuardSession(company, guardId) {
  return company.checkedReport.find((report) =>
    String(report.guardId) === String(guardId) && report.checkIn === true
  );
}

function getActiveClock(report) {
  if (!report || !Array.isArray(report.clock)) return null;
  return report.clock.find((clock) => clock.isActive === true) || null;
}

function serializeActiveSession(report) {
  if (!report) return null;
  const activeClock = getActiveClock(report);
  return {
    reportId: String(report._id),
    guardId: String(report.guardId || ""),
    postSiteId: String(report.postSite || ""),
    clientId: String(report.client || ""),
    checkedIn: report.checkIn === true,
    checkInAt: report.checkInAt || report.checkInTime || null,
    checkInTime: report.checkInTime || null,
    clockedIn: Boolean(activeClock),
    clockId: activeClock ? String(activeClock._id) : null,
    clockInAt: activeClock?.clockInAt || activeClock?.clockInTime || null,
    clockInTime: activeClock?.clockInTime || null,
    isOnBreak: activeClock?.isOnBreak === true,
    breakStartedAt: activeClock?.breakStartedAt || null,
    totalBreakSeconds: Number(activeClock?.totalBreakSeconds || 0),
    selectedShift: activeClock ? {
      _id: activeClock.shiftTemplateId || null,
      shiftTitle: activeClock.shiftTitle || null,
      startTime: activeClock.shiftStartTime || null,
      endTime: activeClock.shiftEndTime || null,
      postSiteId: String(report.postSite || ""),
    } : null,
  };
}

app.get("/guard-active-session", async (req, res) => {
  try {
    const companyId = String(req.query.companyId || "");
    const guardId = String(req.query.guardId || "");
    if (!companyId || !guardId) {
      return res.status(400).json({ success: false, message: "companyId and guardId are required." });
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found." });
    }

    const activeReport = getActiveGuardSession(company, guardId);
    return res.json({ success: true, activeSession: serializeActiveSession(activeReport) });
  } catch (error) {
    console.error("ACTIVE SESSION ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to retrieve active session." });
  }
});

app.post("/checking", async (req, res) => {
  try {
    const { time, guardInfo, postSiteId, clientId } = req.body;
    const companyId = guardInfo?.assignedCompanyID;
    const guardId = guardInfo?._id;

    if (!companyId || !guardId || !postSiteId) {
      return res.status(400).json({
        success: false,
        message: "Guard, company and post site information are required.",
      });
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found." });
    }

    const activeReport = getActiveGuardSession(company, guardId);
    if (activeReport) {
      const samePost = String(activeReport.postSite) === String(postSiteId);
      return res.status(409).json({
        success: false,
        activeSessionExists: true,
        message: samePost
          ? "You are already checked in at this post site."
          : "You are already checked in at another post site.",
        activeSession: serializeActiveSession(activeReport),
      });
    }

    const checkInAt = time ? new Date(time) : new Date();
    const reportNew = {
      client: String(clientId || ""),
      postSite: String(postSiteId),
      guardName: guardInfo.fullname,
      guardId: String(guardId),
      checkIn: true,
      checkout: false,
      checkInTime: checkInAt.toISOString(),
      checkInAt,
    };

    company.checkedReport.push(reportNew);
    const addedReport = company.checkedReport[company.checkedReport.length - 1];
    const activity = notification(guardInfo.fullname, guardInfo.username, "Check In", addedReport._id);
    activity.message = `${guardInfo.fullname} checked in`;
    company.activity.push(activity);
    await company.save();

    return res.json({
      success: true,
      message: "Guard successfully checked in.",
      reportId: String(addedReport._id),
      activeSession: serializeActiveSession(addedReport),
    });
  } catch (error) {
    console.error("CHECK IN ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to check in guard." });
  }
});

app.post("/checkingout", async (req, res) => {
  try {
    const { dbId, guardInfo, checkouttime } = req.body;
    const company = await Company.findById(guardInfo?.assignedCompanyID);
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found." });
    }

    const report = company.checkedReport.id(dbId);
    if (!report) {
      return res.status(404).json({ success: false, message: "Active check-in record not found." });
    }

    const activeClock = getActiveClock(report);
    if (activeClock) {
      return res.status(409).json({
        success: false,
        message: "Clock out before checking out from the post site.",
        activeSession: serializeActiveSession(report),
      });
    }

    const checkedOutAt = checkouttime ? new Date(checkouttime) : new Date();
    report.checkIn = false;
    report.checkOutTime = checkedOutAt.toISOString();
    report.checkedOutAt = checkedOutAt;

    const activity = notification(guardInfo.fullname, guardInfo.username, "Check Out", dbId);
    activity.message = `${guardInfo.fullname} checked out`;
    company.activity.push(activity);
    await company.save();

    return res.json({ success: true, message: "Guard successfully checked out.", activeSession: null });
  } catch (error) {
    console.error("CHECK OUT ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to check out guard." });
  }
});

app.post("/clocking", async (req, res) => {
  try {
    const { reportId, guardInfo, clockInAt, shiftTemplateId, shiftTitle, shiftStartTime, shiftEndTime } = req.body;
    const company = await Company.findById(guardInfo?.assignedCompanyID);
    if (!company) return res.status(404).json({ success: false, message: "Company not found." });

    const activeReport = getActiveGuardSession(company, guardInfo?._id);
    if (!activeReport) {
      return res.status(409).json({ success: false, message: "Check in before clocking in." });
    }
    if (String(activeReport._id) !== String(reportId)) {
      return res.status(409).json({
        success: false,
        message: "You are checked in at another post site.",
        activeSession: serializeActiveSession(activeReport),
      });
    }
    if (getActiveClock(activeReport)) {
      return res.status(409).json({
        success: false,
        message: "You are already clocked in.",
        activeSession: serializeActiveSession(activeReport),
      });
    }

    const startedAt = clockInAt ? new Date(clockInAt) : new Date();
    activeReport.clock.push({
      clockInTime: startedAt.toISOString(),
      clockInAt: startedAt,
      isActive: true,
      isOnBreak: false,
      totalBreakSeconds: 0,
      shiftTemplateId,
      shiftTitle,
      shiftStartTime,
      shiftEndTime,
    });
    const clock = activeReport.clock[activeReport.clock.length - 1];
    await company.save();

    return res.json({
      success: true,
      message: "Guard successfully clocked in.",
      clockId: String(clock._id),
      activeSession: serializeActiveSession(activeReport),
    });
  } catch (error) {
    console.error("CLOCK IN ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to clock in guard." });
  }
});

app.post("/clockingout", async (req, res) => {
  try {
    const { reportId, guardInfo, clockOutAt } = req.body;
    const company = await Company.findById(guardInfo?.assignedCompanyID);
    if (!company) return res.status(404).json({ success: false, message: "Company not found." });

    const report = company.checkedReport.id(reportId);
    const clock = getActiveClock(report);
    if (!report || !clock) {
      return res.status(404).json({ success: false, message: "Active clock session not found." });
    }

    const endedAt = clockOutAt ? new Date(clockOutAt) : new Date();
    let totalBreakSeconds = Number(clock.totalBreakSeconds || 0);
    if (clock.isOnBreak && clock.breakStartedAt) {
      totalBreakSeconds += Math.max(0, Math.floor((endedAt - new Date(clock.breakStartedAt)) / 1000));
    }
    const totalSeconds = Math.max(0, Math.floor((endedAt - new Date(clock.clockInAt || clock.clockInTime)) / 1000));
    const workSeconds = Math.max(0, totalSeconds - totalBreakSeconds);
    const formatSeconds = (value) => {
      const h = Math.floor(value / 3600);
      const m = String(Math.floor((value % 3600) / 60)).padStart(2, "0");
      const sec = String(value % 60).padStart(2, "0");
      return `${h}:${m}:${sec}`;
    };

    let assignedSeconds = 0;
    if (clock.shiftStartTime && clock.shiftEndTime) {
      const [sh, sm] = String(clock.shiftStartTime).split(":").map(Number);
      const [eh, em] = String(clock.shiftEndTime).split(":").map(Number);
      let startSeconds = (sh * 3600) + (sm * 60);
      let endSeconds = (eh * 3600) + (em * 60);
      if (endSeconds < startSeconds) endSeconds += 86400;
      assignedSeconds = endSeconds - startSeconds;
    }
    const overtimeSeconds = assignedSeconds > 0 ? Math.max(0, workSeconds - assignedSeconds) : 0;

    clock.clockOutAt = endedAt;
    clock.clockOutTime = endedAt.toISOString();
    clock.isActive = false;
    clock.isOnBreak = false;
    clock.breakStartedAt = null;
    clock.totalBreakSeconds = totalBreakSeconds;
    clock.workTime = formatSeconds(workSeconds);
    clock.breakTime = formatSeconds(totalBreakSeconds);
    clock.duration = formatSeconds(totalSeconds);
    clock.overtimeSeconds = overtimeSeconds;
    clock.overtime = formatSeconds(overtimeSeconds);

    const activity = notification(guardInfo.fullname, guardInfo.username, "Clock Out", reportId);
    activity.message = `${guardInfo.fullname} clocked out`;
    company.activity.push(activity);
    await company.save();

    return res.json({
      success: true,
      message: "Guard successfully clocked out.",
      companyInfo: company,
      activeSession: serializeActiveSession(report),
    });
  } catch (error) {
    console.error("CLOCK OUT ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to clock out guard." });
  }
});

app.post("/clock-break", async (req, res) => {
  try {
    const { reportId, guardInfo, action, at } = req.body;
    const company = await Company.findById(guardInfo?.assignedCompanyID);
    const report = company?.checkedReport.id(reportId);
    const clock = getActiveClock(report);
    if (!company || !report || !clock) {
      return res.status(404).json({ success: false, message: "Active clock session not found." });
    }

    const eventAt = at ? new Date(at) : new Date();
    if (action === "start") {
      if (!clock.isOnBreak) {
        clock.isOnBreak = true;
        clock.breakStartedAt = eventAt;
      }
    } else if (action === "end") {
      if (clock.isOnBreak && clock.breakStartedAt) {
        clock.totalBreakSeconds = Number(clock.totalBreakSeconds || 0) +
          Math.max(0, Math.floor((eventAt - new Date(clock.breakStartedAt)) / 1000));
      }
      clock.isOnBreak = false;
      clock.breakStartedAt = null;
    } else {
      return res.status(400).json({ success: false, message: "Break action must be start or end." });
    }

    await company.save();
    return res.json({ success: true, activeSession: serializeActiveSession(report) });
  } catch (error) {
    console.error("BREAK ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to update break." });
  }
});

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

app.post("/reports-view", async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.redirect("/sign-in");
    }

    const reportId = req.body.reportId;

    const singleReport = await MobileReport.findById(reportId);

    if (!singleReport) {
      return res.status(404).send("Report not found.");
    }

    if (isClientUser(req.user)) {
      const { assignedPostSiteId } = await getClientScope(req.user);

      if (
        String(singleReport?.fields?.postSiteId || "") !==
        String(assignedPostSiteId || "")
      ) {
        return res.status(403).send("Unauthorized");
      }
    }

    const myCom = await findCompany(
      req.user.assignedCompanyID,
      singleReport.fields?.postSiteId
    );

    if (
      singleReport.fields?.postSiteId &&
      myCom?.postSite?.[0]
    ) {
      singleReport.fields.postSiteName =
        myCom.postSite[0].siteName;
    }

    let template = null;

    if (singleReport.templateId) {
      template = await ReportTemplate.findById(
        singleReport.templateId
      ).lean();
    }

    const templateFieldMap = {};

    if (template?.fields?.length) {
      template.fields.forEach((field) => {
        templateFieldMap[field.keyName] = field.label;
      });
    }

    const reportFields = Object.entries(
      singleReport.fields || {}
    ).map(([keyName, value]) => {
      let label = templateFieldMap[keyName];

      /*
       * Fallback for old reports or fields that do not
       * exist in the report template.
       */
      if (!label) {
        label = keyName
          .replace(/[_-]+/g, " ")
          .replace(/\b\w/g, (letter) =>
            letter.toUpperCase()
          );
      }

      return {
        keyName,
        label,
        value,
      };
    });

    return res.render("dashboard/view-report", {
      userInfo: req.user,
      reports: singleReport,
      companyInfo: myCom,
      reportFields,
    });
  } catch (error) {
    console.error("View report error:", error);
    return res.status(500).send("Server error viewing report.");
  }
});

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

