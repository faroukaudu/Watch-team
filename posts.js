// routes/postOrders.js
const express = require("express");
const app = express();
const PostOrder = require("../models/PostOrder"); // <- your mongoose model

app.get("/post-orders", async (req, res) => {
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
