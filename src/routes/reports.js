const Report = require("../models/report");
const mongoose = require("mongoose");
const passport = require("passport");
const session = require("express-session");
var companyInfo = require("../../db/companyinfodb");
const ReportTemplate = require("../models/reportTemplate");
const { emailSent } = require("../../nodemailer");
const crypto = require("crypto");
const PublicReportBatch = require("../models/PublicReportBatch");

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

      // code red start
      // code red start
      // code red start
      if (category === "code_red") {
        try {
          const postSiteId = fields?.postSiteId || fields?.postSiteID || "";

          console.log("Received postSiteId:", postSiteId);
          console.log("All post sites:", comFound.postSite);

          const postSite = (comFound.postSite || []).find((site) => {
            return (
              String(site._id) === String(postSiteId) ||
              String(site.postSiteID) === String(postSiteId)
            );
          });
          console.log("Matched postSite:", postSite);

          if (!postSite) {
            console.log("Code Red: Post site not found");
          } else {
            console.log("Recipients from DB:", postSite?.reportRecipients);
            const recipients = (postSite.reportRecipients || [])
              .filter(Boolean)
              .filter((email, index, arr) => arr.indexOf(email) === index);
            //     const recipients = Array.isArray(postSite.reportRecipients)
            // ? postSite.reportRecipients
            // : [];
            console.log("Final recipients:", recipients);

            if (recipients.length > 0) {
              const subject = `🚨 CODE RED ALERT - ${template?.title || title || "Emergency Report"}`;



              const token = crypto.randomBytes(32).toString("hex");

              const expiry = new Date();
              expiry.setDate(expiry.getDate() + 30);

              await PublicReportBatch.create({
                token,
                reportIds: [report._id],
                clientEmail: recipients[0],
                ccRecipients: recipients.slice(1),
                title: `Code Red Alert - ${template?.title || title || "Emergency Report"}`,
                expiresAt: expiry,
              });

              const baseUrl = process.env.PUBLIC_BASE_URL || "http://localhost:9000";
              const publicReportLink = `${baseUrl}/public/reports/${token}`;

              const html = `
          <div style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;">
            <div style="max-width:700px;margin:auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #ddd;">
              <div style="background:#dc3545;color:white;padding:20px;">
                <h2 style="margin:0;">🚨 CODE RED ALERT</h2>
                <p style="margin:6px 0 0;">Immediate attention required</p>
              </div>

              <div style="padding:22px;color:#222;">
                <p><strong>Report:</strong> ${template?.title || title || "Code Red Report"}</p>
                <p><strong>Guard:</strong> ${userInfo.fullname || "Unknown Guard"}</p>
                <p><strong>Post Site:</strong> ${postSite.siteName || postSite.name || "Unknown Site"}</p>
                <p><strong>Company:</strong> ${comFound.companyName || comFound.name || ""}</p>
                <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>

                <hr style="border:none;border-top:1px solid #ddd;margin:20px 0;">

                <p>
                  A Code Red report has been submitted from the Watch Team mobile app.
                  Please log in to the Watch Team dashboard to review the full report details.
                </p>
                  <div style="margin:28px 0;text-align:center;">
                    <a href="${publicReportLink}"
                      style="display:inline-block;background:#dc3545;color:#ffffff;text-decoration:none;padding:14px 26px;border-radius:10px;font-size:15px;font-weight:700;">
                      View Full Report
                    </a>
                  </div>

                  <p style="margin:0;font-size:13px;word-break:break-all;color:#dc3545;">
                    ${publicReportLink}
                  </p>
              </div>

              <div style="background:#111827;color:#fff;padding:14px 20px;font-size:12px;">
                Watch Team Security Report Notification
              </div>
            </div>
          </div>
        `;

              //         console.log("fields received:", fields);
              // console.log("postSiteId received:", fields?.postSiteId);

              await emailSent({
                sendTo: recipients.join(","),
                title: subject,
                message: "A Code Red report has been submitted and requires immediate attention.",
                template: html,
                emailType: "code_red"
              });
            } else {
              console.log("Code Red: No report recipients found for this post site");
            }
          }
        } catch (err) {
          console.log("Code Red email error:", err);
        }
      }
      // code red end
      // code red end

      // end

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

