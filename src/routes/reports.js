const Report = require("../models/report");
const mongoose = require("mongoose");
const passport = require("passport");
const session = require("express-session");
var companyInfo = require("../../db/companyinfodb");
const ReportTemplate = require("../models/reportTemplate");

const Company = mongoose.model("Company", companyInfo);


module.exports = function registerReportRoutes(app) {
  // Test route
  app.get("/cat", (req, res) => {
    res.send("TIMAYA");
  });

  // POST /reports  -> create report first
  app.post("/reports", async (req, res) => {
    try {
      const { title, fields, userInfo, templateId } = req.body;

      if (!title) {
        return res.status(400).json({ error: "title is required" });
      }

      if (!userInfo?.assignedCompanyID) {
        return res.status(400).json({ error: "assignedCompanyID is required" });
      }

      const comFound = await Company.findById(userInfo.assignedCompanyID);
      if (!comFound) {
        return res.status(404).json({ error: "Company not found" });
      }

      let category = "general";
      let template = null;

      if (templateId) {
        template = await ReportTemplate.findOne({
          _id: templateId,
          companyID: comFound._id.toString(),
          active: true,
        });

        if (template) {
          category = (template.category || "general").toLowerCase();
        }
      }
      // Check for bugs

      console.log("templateId:", templateId);
      console.log("assignedCompanyID:", userInfo.assignedCompanyID);
      console.log("matched template:", template ? template.title : null);
      console.log("resolved category:", category);

      const report = await Report.create({
        title: template?.title || title,
        templateId: templateId || "",
        category,
        fields: fields || {},
        userId: (userInfo._id || "").toString(),
        fullname: userInfo.fullname || "",
        companyID: comFound._id,
        status: false,
      });

      return res.json({
        reportId: report._id.toString(),
        report,
      });
    } catch (err) {
      console.error("Create report error:", err);
      return res.status(500).json({ error: "Server error creating report" });
    }
  });

  // POST /reports/:id/attachments -> save Cloudinary refs
  app.post("/reports/:id/attachments", async (req, res) => {
    try {
      const reportId = req.params.id;
      const { kind, publicId, secureUrl, resourceType, format, bytes, duration } = req.body;

      if (!kind || !publicId || !secureUrl || !resourceType) {
        return res.status(400).json({ error: "Missing attachment fields" });
      }

      const updated = await Report.findByIdAndUpdate(
        reportId,
        {
          $push: {
            attachments: { kind, publicId, secureUrl, resourceType, format, bytes, duration },
          },
        },
        { new: true }
      );

      return res.json({ ok: true, report: updated });
    } catch (err) {
      console.error("Save attachment error:", err);
      return res.status(500).json({ error: "Server error saving attachment" });
    }
  });


  // get routes

  // GET /reports?scope=all|my&userId=xxxx&q=break
  app.get("/reports", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit || "50", 10), 200);
      const skip = Math.max(parseInt(req.query.skip || "0", 10), 0);

      const q = (req.query.q || "").trim();
      const scope = (req.query.scope || "all").toLowerCase();
      const userId = (req.query.userId || "").toString();
      const companyId = (req.query.companyId || "").toString();

      if (!companyId) {
        return res.status(400).json({ error: "companyId is required" });
      }

      const filter = {
        companyID: companyId,
      };

      if (q) {
        filter.title = { $regex: q, $options: "i" };
      }

      if (scope === "my") {
        if (!userId) {
          return res.status(400).json({ error: "userId is required for scope=my" });
        }
        filter.userId = userId;
      }

      const items = await Report.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("_id title category templateId createdAt attachments userId fullname companyID")

      const total = await Report.countDocuments(filter);

      return res.json({ ok: true, total, items });
    } catch (err) {
      console.error("List reports error:", err);
      return res.status(500).json({ error: "Server error listing reports" });
    }
  });

  app.get("/reports/:id", async (req, res) => {
    const report = await Report.findById(req.params.id);
    return res.json({ ok: true, report });
  });

};

