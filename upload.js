// const myModule = require('./index.js');
// const myReport = require( "./db/report.js");
// const mongoose = require("mongoose");
// const app = myModule.main;

// const Report = mongoose.model("Report",myReport);

// app.post("/reports", async (req, res) => {
//     // res.send("blocking");
//   const { title, fields } = req.body;
//   if (!title) return res.status(400).json({ error: "title is required" });

//   const report = await Report.create({ title, fields: fields || {} });
//   res.json({ reportId: report._id.toString(), report });
// });

// // POST /reports/:id/attachments -> save Cloudinary refs
// app.post("/:id/attachments", async (req, res) => {
//   const reportId = req.params.id;
//   const { kind, publicId, secureUrl, resourceType, format, bytes, duration } = req.body;

//   if (!kind || !publicId || !secureUrl || !resourceType) {
//     return res.status(400).json({ error: "Missing attachment fields" });
//   }

//   const updated = await Report.findByIdAndUpdate(
//     reportId,
//     {
//       $push: {
//         attachments: { kind, publicId, secureUrl, resourceType, format, bytes, duration },
//       },
//     },
//     { new: true }
//   );

//   res.json({ ok: true, report: updated });
// });


// routes/postOrders.js
const express = require("express");
const router = express.Router();
const PostOrder = require("../models/PostOrder"); // <- your mongoose model

router.get("/post-orders", async (req, res) => {
  try {
    // Example: by company
    const companyID = req.user?.assignedCompanyID || req.query.companyID;

    const orders = await PostOrder.find({ companyID })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ success: true, data: orders }); // data is []
  } catch (err) {
    console.error("post-orders error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;

