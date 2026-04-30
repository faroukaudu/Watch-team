const myModule = require('./index.js');
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const passport = require("passport");
const session = require("express-session");
const _ = require('lodash');
var companyInfo = require(__dirname + "/db/companyinfodb.js");
const Note = require("./src/models/note.js");


const app = myModule.main;
const User = myModule.userDB;
const Company = mongoose.model("Company", companyInfo);
const MobileReport = require("./src/models/report.js");
const { log } = require('handlebars');
const ScheduledPostSiteReport = require("./src/models/ScheduledPostSiteReport");
const ScheduledPostSiteReportLog = require("./src/models/ScheduledPostSiteReportLog");

const { getResolvedFeatures, getLimitValue, isUnlimited } = require("./src/utils/subscriptionLimits");
const { redirectToPricingWithUpgradeMessage } = require("./src/utils/upgradeRedirect");
const Checklist = require("./src/models/Checklist");
const PostSiteTask = require("./src/models/PostSiteTask");


// View Client Details.
// Rendering Client Edit
app.post("/view-client", (req, res) => {
  console.log(req.body.userid);

  req.session.clientId = req.body.userid;
  res.redirect("/client-info");

})


app.get("/client-info", (req, res) => {
  const cID = req.session.clientId;
  // delete req.session.clientId;

  if (req.isAuthenticated()) {
    console.log(cID);

    User.findById(cID).then((userFound) => {
      Company.findById(req.user.assignedCompanyID).then((comF) => {
        res.render("dashboard/client-edit", {
          userInfo: req.user,
          clientInfo: userFound, companyInfo: comF.postSite,
          fullCompInfo: comF
        });
      });
    }).catch((err) => {
      res.send(err);
    })
  } else {
    res.redirect("/sign-in");
  }

})


// Update Client User Info
app.post("/update-client", async (req, res) => {
  const { fullname, email, phone, address, clientID } = req.body;
  const updateData = {
    fullname: fullname,
    email: email,
    phone: phone,
    address: address,

  }

  console.log("userID::", req.user.clientID);



  console.log(updateData);

  try {
    await User.findByIdAndUpdate(clientID, updateData, { new: true });
    res.redirect("/client-info");

  } catch (error) {
    res.send(error);
  }
});


// Delete Client User
app.post("/delete-client", async (req, res) => {
  console.log("Deleting CLients");
  console.log(req.body.deleteID);



  try {
    await User.deleteOne({ _id: req.body.deleteID });
    res.redirect("/clients");
  } catch (error) {
    res.send(error);

  }
})

// Creating Post Sites
app.post("/create-post-site", async (req, res) => {
  if (req.isAuthenticated()) {
    const { siteName, client, address, clientInformation, lat, long } = req.body;
    const [clientID, clientName] = clientInformation.split("&");

    const site = {
      siteName: siteName,
      clientID: clientID,
      clientName: clientName,
      address: address,
      lat: lat,
      long: long,
      statusIsActive: true,
    };

    console.log("SITE IS", site);

    if (req.user.userType === "Super Admin") {
      console.log("i am Admin");
      console.log(req.user.assignedCompanyID);

      try {
        const companyId = req.session.companyID || req.user?.assignedCompanyID;

        const company = await Company.findById(companyId);

        if (!company) {
          req.session.post = {
            status: false,
            message: "Company not found."
          };
          return res.redirect("/post-site");
        }

        // Restriction
        const features = await getResolvedFeatures(companyId);
        const maxPostSites = getLimitValue(features, "maxPostSites");

        if (!isUnlimited(maxPostSites)) {
          const currentPostSites = Array.isArray(company.postSite)
            ? company.postSite.length
            : 0;

          if (currentPostSites >= maxPostSites) {
            return redirectToPricingWithUpgradeMessage(
              req,
              res,
              "Your current subscription allows only " +
                maxPostSites +
                " post site(s). Please upgrade your subscription to add more."
            );
          }
        }

        company.postSite.push(site);
        await company.save();

        req.session.post = {
          status: true,
          message: "Site Created Successfully!"
        };

        return res.redirect("/post-site");
      } catch (err) {
        console.log(err);
        return res.send(err);
      }
    } else {
      return res.send("Only Admin can add user.");
    }
  } else {
    return res.send("Only Admin can add user.");
    // res.redirect("/sign-in");
  }
});

app.post("/view-post-site", (req, res) => {
  const postSiteID = req.body.postsite_id;
  req.session.postSiteID = postSiteID;

  return res.redirect("/view-post-site");
});

// async function report (req){
//     console.log("<><><><>loging in my report");

// const newpostSiteID = req.session.postSiteID;
// console.log(newpostSiteID);

// const postReport = await MobileReport.find({companyID:req.user.assignedCompanyID,
//     "fields.postSiteId":newpostSiteID
// },
// {
//       fullname: 1,
//       fields: 1,
//       title: 1,
//       category: 1,
//       createdAt: 1
//     }
// );
// console.log(postReport);
// return postReport;


// }

app.get("/view-post-site", async (req, res) => {


  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.redirect("/sign-in");
    }

    const postSiteID = req.session.postSiteID;
    delete req.session.clientId;

    if (!postSiteID) {
      return res.status(400).send("No post site selected.");
    }

    // guard side
    const postReport = await MobileReport.find({
      companyID: req.user.assignedCompanyID,
      "fields.postSiteId": postSiteID
    },
      {
        fullname: 1,
        fields: 1,
        title: 1,
        category: 1,
        createdAt: 1
      }
    );

    console.log(postReport);
    // guard side

    const companyId = req.user.assignedCompanyID;

    // current logged in user
    const userFound = await User.findById(req.user.id);

    // company + the selected post site only
    const comF = await Company.findOne(
      {
        _id: companyId,
        "postSite._id": postSiteID,
      },
      {
        companyName: 1,
        postSite: { $elemMatch: { _id: postSiteID } },
      }
    );

    if (!comF || !comF.postSite || comF.postSite.length === 0) {
      return res.status(404).send("Post site not found.");
    }

    // ✅ define siteInfo here
    const siteInfo = comF.postSite[0];

    const postSiteIdStr = String(siteInfo._id);

    // for sheduled
    const schedules = await ScheduledPostSiteReport.find({
      companyId: String(companyId),
      postSiteId: postSiteIdStr,
      isActive: true,
    }).lean();

    const scheduleMap = {};
    schedules.forEach((item) => {
      scheduleMap[String(item.clientEmail).toLowerCase()] = item;
    });

    // assigned guards for this post site
    const assignedGuards = await User.find({
      assignedCompanyID: companyId,
      userType: "AmobileGuard",
      guardPostSite: {
        $elemMatch: { postSiteID: postSiteID },
      },
    }).sort({ fullname: 1 });

    // clients under same company
    const clients = await User.find({
      assignedCompanyID: companyId,
      userType: "Client",
    })
      .select("fullname phone email")
      .sort({ fullname: 1 });

    // reports linked to this post site
    const reports = await MobileReport.find({
      "fields.postSiteId": postSiteIdStr,
    }).sort({ createdAt: -1 });

    // report summary
    const reportSummary = {
      total: reports.length,
      incident: 0,
      standard: 0,
      general: 0,
      log: 0,
      nfc: 0,
    };

    reports.forEach((rep) => {
      if (rep.category === "incident") {
        reportSummary.incident++;
      } else if (rep.category === "standard") {
        reportSummary.standard++;
      } else if (rep.category === "general") {
        reportSummary.general++;
      } else if (rep.category === "log") {
        reportSummary.log++;
      } else if (rep.category === "nfc") {
        reportSummary.nfc++;
      }
    });

    // latest activity from reports first
    const latestActivity = reports.slice(0, 10).map((r) => ({
      type: "report",
      title: r.title || "Report",
      subtitle: r.fullname ? `Submitted by ${r.fullname}` : "Report submitted",
      status: r.status ? "Approved" : "Pending",
      createdAt: r.createdAt,
      category: r.category || "general",
    }));

    // console.log({
    //   siteInfo,
    //   assignedGuards,
    //   clients,
    //   reports,
    //   reportSummary,
    //   latestActivity,
    // });

const notes = await Note.find({
  companyID: String(req.user.assignedCompanyID),
  postSiteID: String(comF.postSite[0]._id),
}).sort({ createdAt: -1 }).lean();

const checklists = await Checklist.find({
  companyId: String(companyId),
  postSiteId: postSiteIdStr,
}).sort({ createdAt: -1 });

const postSiteTasks = await PostSiteTask.find({
  companyId: String(companyId),
  postSiteId: postSiteIdStr
}).sort({ createdAt: -1 }).lean();

console.log("POST SITE ID:", postSiteIdStr);
console.log("CHECKLIST FOUND:", checklists.length);
    return res.render("dashboard/post-site-info", {
      userInfo: req.user,
      clientInfo: userFound,
      companyInfo: siteInfo,
      fullCompInfo: comF,
      assignedGuards,
      clients,
      reports,
      reportSummary,
      latestActivity,
      scheduleMap,
      notes,
      checklists,
      postSiteTasks,
    });
  } catch (err) {
    console.error("GET /view-post-site error:", err);
    return res.status(500).send("Server error");
  }
});