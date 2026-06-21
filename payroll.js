const myModule = require('./index.js');
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const passport = require("passport");
const session = require("express-session");
const _ = require('lodash');
var companyInfo = require(__dirname + "/db/companyinfodb.js");
const { ObjectId } = require("mongodb");
const MobileReport = require("./src/models/report.js");

const app = myModule.main;
const User = myModule.userDB;
const Company = mongoose.model("Company", companyInfo);




function nextDayISO(dateStr) {
  const d = new Date(dateStr + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

async function getGuardWorkTimeDetailed(companyId, guardId, fromDate, toDate) {
  const result = await Company.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(companyId) } },
    { $unwind: "$checkedReport" },

    // ✅ guardId match (STRING MATCH)
    { $match: { "checkedReport.guardId": String(guardId) } },

    // ✅ extract date only: "YYYY-MM-DD" from ISO string
    {
      $addFields: {
        checkInDate: { $substrBytes: ["$checkedReport.checkInTime", 0, 10] },
      },
    },

    // ✅ date range inclusive
    { $match: { checkInDate: { $gte: fromDate, $lte: toDate } } },

    // ✅ keep reports even if clock is empty
    {
      $unwind: {
        path: "$checkedReport.clock",
        preserveNullAndEmptyArrays: true,
      },
    },

    // ✅ handle missing workTime
    {
      $addFields: {
        workTimeStr: { $ifNull: ["$checkedReport.clock.workTime", "0:00:00.000000"] },
      },
    },

    // split "H:MM:SS.micro"
    { $addFields: { workParts: { $split: ["$workTimeStr", ":"] } } },
    {
      $addFields: {
        workHours: { $toInt: { $arrayElemAt: ["$workParts", 0] } },
        workMins: { $toInt: { $arrayElemAt: ["$workParts", 1] } },
        workSecMicro: { $arrayElemAt: ["$workParts", 2] },
      },
    },
    {
      $addFields: {
        workSecsOnly: {
          $toDouble: { $arrayElemAt: [{ $split: ["$workSecMicro", "."] }, 0] },
        },
      },
    },
    {
      $addFields: {
        workTotalSeconds: {
          $add: [
            { $multiply: ["$workHours", 3600] },
            { $multiply: ["$workMins", 60] },
            "$workSecsOnly",
          ],
        },
      },
    },

    // ✅ return BOTH: list + totals
    {
      $facet: {
        details: [
          {
            $project: {
              _id: 0,

              reportId: "$checkedReport._id",
              clockId: "$checkedReport.clock._id",

              guardId: "$checkedReport.guardId",

              // ✅ THESE FIELDS MUST EXIST INSIDE checkedReport
              guardName: "$checkedReport.guardName",
              email: "$checkedReport.email",
              postSite: "$checkedReport.postSite",

              checkInTime: "$checkedReport.checkInTime",

              workTime: "$workTimeStr",
              overtime: { $ifNull: ["$checkedReport.clock.overtime", "0:00:00"] },
              overtimeSeconds: { $ifNull: ["$checkedReport.clock.overtimeSeconds", 0] },
              shiftTitle: "$checkedReport.clock.shiftTitle",
              workTotalSeconds: 1,


    // ✅ NEW FIELD (Decimal Hours)
   workTotalHour: {
  $let: {
    vars: {
      totalSecs: "$workTotalSeconds"
    },
    in: {
      $concat: [
        {
          $toString: {
            $floor: { $divide: ["$$totalSecs", 3600] }
          }
        },
        ":",
        {
          $toString: {
            $floor: {
              $divide: [
                { $mod: ["$$totalSecs", 3600] },
                60
              ]
            }
          }
        },
        ":",
        {
          $toString: {
            $floor: { $mod: ["$$totalSecs", 60] }
          }
        }
      ]
    }
  }
}
            },
          },
          { $sort: { checkInTime: 1 } },
        ],

        summary: [
          {
            $group: {
              _id: null,
              totalWorkSeconds: { $sum: "$workTotalSeconds" },
              totalOvertimeSeconds: { $sum: { $ifNull: ["$checkedReport.clock.overtimeSeconds", 0] } },
              matchedClockHits: { $sum: 1 }, // each unwind of clock
              matchedReportIds: { $addToSet: "$checkedReport._id" },
            },
          },
          {
            $addFields: {
              matchedReportCount: { $size: "$matchedReportIds" },
            },
          },
          {
            $project: {
              _id: 0,
              matchedReportIds: 0,
            },
          },
        ],
      },
    },
  ]);

  const payload = result?.[0] || { details: [], summary: [] };
  return {
    details: payload.details || [],
    summary: payload.summary?.[0] || {
      totalWorkSeconds: 0,
      matchedClockHits: 0,
      matchedReportCount: 0,
    },
  };
}

app.post("/generate-payroll", async (req, res) => {
  if (!req.isAuthenticated()) return res.redirect("/sign-in");

  try {
    const { guardId, fromDate, toDate } = req.body;
    if (!guardId || !fromDate || !toDate) {
      return res.status(400).json({ error: "guardId, fromDate, toDate are required" });
    }

    const [, iD] = guardId.split("-");
    const fDate = fromDate.split(" ")[0];
    const tDate = toDate.split(" ")[0];

    const companyId = req.user.assignedCompanyID;

    const result = await getGuardWorkTimeDetailed(companyId, iD, fDate, tDate);
    


      const guards = await User.find({
  assignedCompanyID: req.user.assignedCompanyID,
  userType: "AmobileGuard"
});

    res.render("dashboard/run-payroll",{userInfo:req.user, guards, result});

    // return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});


app.get("/overtime-multiplier", async (req, res) => {
  if (!req.isAuthenticated()) return res.redirect("/sign-in");
  const guards = await User.find({ assignedCompanyID: req.user.assignedCompanyID, userType: "AmobileGuard" });
  res.render("dashboard/overtime-multiplier", { userInfo: req.user, guards, result: [] });
});

app.post("/overtime-multiplier", async (req, res) => {
  if (!req.isAuthenticated()) return res.redirect("/sign-in");
  const { guardId, fromDate, toDate } = req.body;
  const [, iD] = guardId.split("-");
  const fDate = fromDate.split(" ")[0];
  const tDate = toDate.split(" ")[0];
  const result = await getGuardWorkTimeDetailed(req.user.assignedCompanyID, iD, fDate, tDate);
  const guards = await User.find({ assignedCompanyID: req.user.assignedCompanyID, userType: "AmobileGuard" });
  res.render("dashboard/overtime-multiplier", { userInfo: req.user, guards, result });
});
