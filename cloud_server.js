import express from "express";
import cors from "cors";
import mongoose from "mongoose";

import uploads from "./src/routes/uploads.js";
import reports from "./src/routes/reports.js";
// var companyInfo = require(__dirname + "/db/companyinfodb.js");
const app = express();

// const app = myModule.main;
app.use(cors());
app.use(express.json({ limit: "2mb" })); // only JSON refs, not big files

app.use("/uploads", uploads);
app.use("/reports", reports);



