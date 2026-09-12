const myModule = require('./index.js');
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const passport = require("passport");
const session = require("express-session");
const _ = require('lodash');
var companyInfo = require(__dirname + "/db/companyinfodb.js");
const { Types } = require('mongoose');
const axios = require('axios');
require('dotenv').config();
// const guardSiteReg = require('./authentication.js');
// const addingGuardstoPostSite = require("./authentication.js");
const addingGuardstoPostSite = require("./add_gaurd.js");

const app = myModule.main;
const User = myModule.userDB;
const Company = mongoose.model("Company", companyInfo);
const sendingMails = require('./nodemailer.js');
const handlebars = require("handlebars");
const fs = require('fs');
const path = require('path');
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const MobileReport = require("./src/models/report.js");
const PublicReportBatch = require("./src/models/PublicReportBatch");
const cron = require("node-cron");
const ScheduledPostSiteReport = require("./src/models/ScheduledPostSiteReport");
const ScheduledPostSiteReportLog = require("./src/models/ScheduledPostSiteReportLog");
const SiteTour = require("./src/models/SiteTour");
const WatchMode = require("./src/models/WatchMode");
const Note = require("./src/models/note");
const Passdown = require("./src/models/Passdown");
const Dispatch = require("./src/models/Dispatch");
const Visitor = require("./src/models/Visitor");
const VehiclePatrol = require("./src/models/VehiclePatrol");
const Checklist = require("./src/models/Checklist");
const PostSiteTask = require("./src/models/PostSiteTask");
const ParkingManager = require("./src/models/ParkingManager");


app.post("/add-guard-invite", async (req, res) => {
  console.log("Submit guard invite");

  try {
    const {
      fname,
      lname,
      email,
      phone,
      companyID,
      phonetwo,
      invite,
      siteId,
    } = req.body;

    if (invite === "sms") {
      console.log("Sending SMS invite");
      console.log(fname, lname, email, phonetwo, companyID, invite, siteId);

      req.session.guardtoast = {
        status: false,
        message: "SMS guard invitation is not available yet.",
      };

      return res.redirect("/guards");
    }

    const fullname = `${String(fname || "").trim()} ${String(
      lname || ""
    ).trim()}`.trim();

    const sendM = await guardVerify({
      username: fullname,
      email,
      compId: companyID,
      postSite: siteId,
      fullname,
    });

    if (sendM === "Successful") {
      req.session.guardtoast = {
        status: true,
        message: "Guard verification email sent successfully!",
      };
    } else {
      req.session.guardtoast = {
        status: false,
        message: "Guard verification email failed to send.",
      };
    }

    return res.redirect("/guards");
  } catch (err) {
    console.error("POST /add-guard-invite error:", err);

    req.session.guardtoast = {
      status: false,
      message: `Unable to send guard verification email: ${err.message}`,
    };

    return res.redirect("/guards");
  }
});

// Whatsapp
app.get("/whatsapp", (req,res)=>{
    const name = "Farouk Audu";
    const link = "https://www.freepik.com/";
    async function sendTemplateWhatsappMsg(){
    const response = await axios({
        url:'https://graph.facebook.com/v22.0/805938889270636/messages',
        method:'post',
        headers: {
            'Authorization': 'Bearer '+process.env.WHATSAPP_TOKEN,
            'Content-Type': 'application/json'
        },
        data: JSON.stringify({
            messaging_product: 'whatsapp',
            to: '2348160278321',
            text: {
                preview_url: true, // shows a link preview if available
                body: `*Registration Notice*\n\nDear ${name}, you have been registered as a guard at CBN Company.\n\nComplete your setup here:\nhttps://freepik.com/activate?uid=${encodeURIComponent(link)}`
                }
            // template: {
            //     name: 'hello_world',
            //     language: {
            //         code: 'en_US',
            //     }
            // }
        })
    });

    res.send(response.data);
    
}

sendTemplateWhatsappMsg();

});


// Email
async function guardVerify({
  username: name,
  email,
  compId: companyId,
  postSite: siteId,
  fullname: fulln,
}) {
  try {
    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!cleanEmail) {
      throw new Error("Guard email address is required.");
    }

    if (!companyId) {
      throw new Error("Company ID is required.");
    }

    if (!siteId) {
      throw new Error("Post-site ID is required.");
    }

    console.log(`Sending mail to: ${cleanEmail} & Name is ${name}`);

    const link =
      `https://app.watch-team.com/verify-guard/` +
      `${encodeURIComponent(companyId)}/` +
      `${encodeURIComponent(siteId)}/` +
      `${encodeURIComponent(name)}/` +
      `${encodeURIComponent(cleanEmail)}`;

    const source = fs.readFileSync(
      path.join(__dirname, "email_template.html"),
      "utf-8"
    );
    const template = handlebars.compile(source);
    const replacements = {
      username: name,
      email: cleanEmail,
      url: link,
    };

    const htmlToSend = template(replacements);

    await sendingMails.emailSent({
      sendTo: cleanEmail,
      title: "Guard Verification",
      message: "Complete your guard registration.",
      template: htmlToSend,
      emailType: "Guard Registration Successful",
    });

    return "Successful";
  } catch (err) {
    console.error("Guard verification email failed:", err);
    return 0;
  }
}

// Email-New-Admin-Create-Password-Link
async function adminCreatePassword({ email, userID: id, fullname: fulln }) {
  try {
    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!cleanEmail) {
      throw new Error("Admin email address is required.");
    }

    console.log(`Sending mail to: ${cleanEmail} & Name is ${fulln}`);

    const baseUrl = process.env.PUBLIC_BASE_URL || "http://localhost:9000";
    const link = `${baseUrl}/create-password/${encodeURIComponent(
      id
    )}/${encodeURIComponent(fulln)}`;

    const source = fs.readFileSync(
      path.join(__dirname, "admin-create-pass.html"),
      "utf-8"
    );
    const template = handlebars.compile(source);
    const replacements = {
      username: fulln,
      email: cleanEmail,
      url: link,
    };

    const htmlToSend = template(replacements);

    await sendingMails.emailSent({
      sendTo: cleanEmail,
      title: "Admin User Created",
      message: "Create your account password.",
      template: htmlToSend,
      emailType: "Admin Registration Successful",
    });

    return "Successful";
  } catch (err) {
    console.error("Admin create-password email failed:", err);
    return 0;
  }
}

async function fakeEmail({ email, userID: id, fullname: fulln }) {
  try {
    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!cleanEmail) {
      throw new Error("Recipient email address is required.");
    }

    console.log(`Sending mail to: ${cleanEmail} & Name is ${fulln}`);

    const baseUrl = process.env.PUBLIC_BASE_URL || "http://localhost:9000";
    const link = `${baseUrl}/create-password/${encodeURIComponent(
      id
    )}/${encodeURIComponent(fulln)}`;

    const source = fs.readFileSync(
      path.join(__dirname, "admin-create-pass.html"),
      "utf-8"
    );
    const template = handlebars.compile(source);
    const replacements = {
      username: fulln,
      email: cleanEmail,
      url: link,
    };

    const htmlToSend = template(replacements);

    await sendingMails.emailSent({
      sendTo: cleanEmail,
      title: "Admin User Created",
      message: "Create your account password.",
      template: htmlToSend,
      emailType: "Admin Registration Successful",
    });

    return "Successful";
  } catch (err) {
    console.error("Test email failed:", err);
    return 0;
  }
}


// app.get("/sendmail", (req,res)=>{
//     guardVerify({username:"Farouk", email:"fagzy98@gmail.com", guardID:"ioioiooi"});
// })



app.get("/verify-guard/:companyId/:siteId/:fullname/:guardEmail", async (req,res)=>{
    const {companyId, siteId, fullname, guardEmail} = req.params;
    console.log(fullname,siteId,companyId);
try {
    
    const result = await Company.findOne(
  { _id: companyId, "postSite._id": siteId },
  {  companyName: 1,    // <-- project main doc fields
        address: 1,    // <-- project more main fields if needed
    "postSite.$": 1 } // <-- project only the first matched element
       );
       console.log(result);
       

       res.render("auth/guard-reg", {results:result, name:fullname , comID:companyId, email:_.capitalize(guardEmail)});

} catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
    
}
    //    console.log(result);
       
    
});

app.post("/guard-new", async (req,res)=>{
    const { fname, lname, username, comp_id, comp_name, password, phone, siteId } = req.body;
    
        const newGuard = new User({
          username: _.capitalize(username),
          fullname: _.capitalize(fname)+ " "+_.capitalize(lname) ,
          email: _.capitalize(username), // emails should be lowercase
          // assignedCompanyID: "Mine",
          userType: "AmobileGuard",
          phone,
          assignedCompanyID: comp_id,
          compName: comp_name,
          guardClients:[{"name":"EFCC", "id":"My id"}],
          guardPostSite:[{"siteName":"superNull", "postSiteID":siteId}],
    
          status: false,
    
    
        });
    
        try {
          const createdGuard = await User.register(newGuard, password);
          await addingGuardstoPostSite(createdGuard, comp_id);
    
        //   req.session.guardtoast = {
        //     status: true,
        //     message: 'Guard created successfully!'
        //   };
          res.redirect("/sign-in");
          // res.render("dashboard/clients", {success:true, userInfo:req.user});
          // ✅ stays in admin session
        } catch (err) {
          console.error("Registration error:", err);
          res.status(400).send("Error registering Guard: " + err.message);
          // Or: res.render("error-page", { message: "Client registration failed" });
        }

});


app.post("/send-fake", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/sign-in");
  }

  try {
    console.log(req.body.email);
    console.log(req.body.cname);

    const sendM = await fakeEmail({
      email: req.body.email || "fagzy98@gmail.com",
      userID: req.user._id,
      fullname: req.body.cname,
    });

    req.session.guardtoast = {
      status: sendM === "Successful",
      message:
        sendM === "Successful"
          ? "Email sent successfully!"
          : "Email failed to send.",
    };

    return res.redirect("/guards");
  } catch (err) {
    console.error("POST /send-fake error:", err);

    req.session.guardtoast = {
      status: false,
      message: `Email failed to send: ${err.message}`,
    };

    return res.redirect("/guards");
  }
});


// //////////////////////////////////////////////////////////////////

function dateKeyFor(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function fmt(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

function secsFromDuration(value) {
  const parts = String(value || "0:0:0").split(":").map(Number);
  return Math.max(0, (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0));
}
function fmtHours(seconds) {
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

async function buildOperationalActivityReports({ companyId, postSiteId, startDate, endDate }) {
  const start = new Date(startDate), end = new Date(endDate);
  const company = await Company.findById(companyId).lean();
  if (!company) return [];

  const attendance = (company.checkedReport || []).filter(r => {
    const when = new Date(r.checkInAt || r.checkInTime || 0);
    return String(r.postSite || "") === String(postSiteId) && when >= start && when <= end;
  });
  const guardIds = [...new Set(attendance.map(r => String(r.guardId || "")).filter(Boolean))];
  const range = { $gte: start, $lte: end };
  const [submitted, tours, watches, notes, passdowns, dispatches, visitors, patrols, checklists, tasks, parkingZones] = await Promise.all([
    MobileReport.find({ companyID: String(companyId), "fields.postSiteId": String(postSiteId), createdAt: range, systemGenerated: { $ne: true } }).lean().catch(()=>[]),
    SiteTour.find({ companyId: String(companyId), postSiteId: String(postSiteId) }).lean().catch(()=>[]),
    WatchMode.find({ companyId: String(companyId), guardId: { $in: guardIds }, createdAt: range }).lean().catch(()=>[]),
    Note.find({ companyID: String(companyId), postSiteID: String(postSiteId), createdAt: range }).lean().catch(()=>[]),
    Passdown.find({ companyId: String(companyId), postSiteId: String(postSiteId), createdAt: range }).lean().catch(()=>[]),
    Dispatch.find({ companyId: String(companyId), postSiteId: String(postSiteId), createdAt: range }).lean().catch(()=>[]),
    Visitor.find({ companyId: String(companyId), postSiteId: String(postSiteId), createdAt: range }).lean().catch(()=>[]),
    VehiclePatrol.find({ companyId: String(companyId), postSiteId: String(postSiteId) }).lean().catch(()=>[]),
    Checklist.find({ companyId: String(companyId), postSiteId: String(postSiteId) }).lean().catch(()=>[]),
    PostSiteTask.find({ companyId: String(companyId), postSiteId: String(postSiteId) }).lean().catch(()=>[]),
    ParkingManager.find({ companyId: String(companyId), postSiteId: String(postSiteId) }).lean().catch(()=>[]),
  ]);

  const groups = new Map();
  const getGroup = (guardId, guardName, day) => {
    const key = `${guardId}|${day}`;
    if (!groups.has(key)) groups.set(key, { guardId, guardName: guardName || "Guard", day, fields: {} });
    return groups.get(key);
  };

  for (const a of attendance) {
    const day = dateKeyFor(a.checkInAt || a.checkInTime); if (!day) continue;
    const g = getGroup(String(a.guardId||""), a.guardName, day);
    g.fields['Check In'] = fmt(a.checkInAt || a.checkInTime);
    if (a.checkedOutAt || a.checkOutTime) g.fields['Check Out'] = fmt(a.checkedOutAt || a.checkOutTime);
    let worked=0;
    (a.clock || []).forEach((c,i)=>{
      const n=i+1;
      if (c.shiftTitle) g.fields[`Shift ${n}`]=c.shiftTitle;
      if (c.clockInAt || c.clockInTime) g.fields[`Clock In ${n}`]=fmt(c.clockInAt || c.clockInTime);
      if (c.clockOutAt || c.clockOutTime) g.fields[`Clock Out ${n}`]=fmt(c.clockOutAt || c.clockOutTime);
      if (c.workTime) { g.fields[`Work Time ${n}`]=c.workTime; worked += secsFromDuration(c.workTime); }
      if (c.breakTime) g.fields[`Break Time ${n}`]=c.breakTime;
      if (c.overtime && c.overtime !== '0:00:00') g.fields[`Overtime ${n}`]=c.overtime;
    });
    if (worked) g.fields['Total Working Hours']=fmtHours(worked);
  }

  submitted.forEach(r=>{ const day=dateKeyFor(r.createdAt); const gid=String(r.userId||r.fields?.guardId||''); if(!day||!gid)return; const g=getGroup(gid,r.fullname,day); const arr=g.fields['Reports Submitted']||[]; arr.push(`${r.title} (${fmt(r.createdAt)})`); g.fields['Reports Submitted']=arr; });
  tours.forEach(t=>(t.progress||[]).forEach(pr=>{ if(!pr.dateKey || pr.dateKey < dateKeyFor(start) || pr.dateKey > dateKeyFor(end) || !pr.guardId)return; const g=getGroup(String(pr.guardId),pr.guardName,pr.dateKey); const scans=(pr.scannedCheckpoints||[]).map(x=>`${x.checkpointName} - ${x.scanType||'Scan'} - ${fmt(x.scannedAt)}`); if(scans.length) g.fields[`Site Tour - ${t.tourName}`]=scans; if(pr.completionComment) g.fields[`Tour Comment - ${t.tourName}`]=pr.completionComment; if((pr.completionImages||[]).length) g.fields[`Tour Pictures - ${t.tourName}`]=pr.completionImages; }));
  watches.forEach(x=>{const day=dateKeyFor(x.createdAt),g=getGroup(String(x.guardId),x.guardName,day); const a=g.fields['Watch Mode']||[]; a.push(`${fmt(x.createdAt)}${x.note?` - ${x.note}`:''} - ${x.videoUrl}`); g.fields['Watch Mode']=a;});
  notes.forEach(x=>{const g=getGroup(String(x.guardID),x.guardName,dateKeyFor(x.createdAt)); const a=g.fields['Notes']||[]; a.push(`${x.title}: ${x.note}`); g.fields['Notes']=a;});
  passdowns.forEach(x=>{const g=getGroup(String(x.guardId),x.guardName,dateKeyFor(x.createdAt)); const a=g.fields['Passdowns']||[]; a.push(`${x.title}: ${x.message}`); g.fields['Passdowns']=a;});
  dispatches.forEach(x=>{if(!x.guardId)return; const g=getGroup(String(x.guardId),x.guardName,dateKeyFor(x.acceptedAt||x.createdAt)); const a=g.fields['Dispatch']||[]; a.push(`${x.incidentType||'Dispatch'} - ${x.status||''}${x.actionTaken?` - ${x.actionTaken}`:''}`); g.fields['Dispatch']=a;});
  visitors.forEach(x=>{const g=getGroup(String(x.guardId),x.guardName,dateKeyFor(x.visitDateTime||x.createdAt)); const a=g.fields['Visitors']||[]; a.push(`${x.visitorName||'Visitor'} - ${x.purposeOfVisit||''}`); g.fields['Visitors']=a;});
  patrols.forEach(x=>(x.sessions||[]).forEach(pr=>{const when=pr.completedAt||pr.startedAt; if(!when||new Date(when)<start||new Date(when)>end)return; const g=getGroup(String(pr.guardId),pr.guardName,dateKeyFor(when)); const a=g.fields['Vehicle Patrol']||[]; a.push(`${x.patrolName} - ${pr.status}${pr.notes?` - ${pr.notes}`:''}`); g.fields['Vehicle Patrol']=a;}));
  checklists.forEach(x=>(x.progress||[]).forEach(pr=>{if(!pr.updatedAt||new Date(pr.updatedAt)<start||new Date(pr.updatedAt)>end)return; const g=getGroup(String(pr.guardId),'Guard',dateKeyFor(pr.updatedAt)); const a=g.fields['Checklists']||[]; a.push(`${x.name} - ${pr.completed?'Completed':'Updated'}`); g.fields['Checklists']=a;}));
  tasks.forEach(x=>(x.completions||[]).forEach(pr=>{if(!pr.completedAt||new Date(pr.completedAt)<start||new Date(pr.completedAt)>end)return; const g=getGroup(String(pr.guardId),'Guard',dateKeyFor(pr.completedAt)); const a=g.fields['Tasks']||[]; a.push(`${x.taskName} - ${pr.status}`); g.fields['Tasks']=a;}));
  parkingZones.forEach(z=>(z.records||[]).forEach(r=>{const when=r.createdAt||r.checkedInAt; if(!when||new Date(when)<start||new Date(when)>end)return; const g=getGroup(String(r.guardId),r.guardName,dateKeyFor(when)); const a=g.fields['Parking Activity']||[]; a.push(`${r.type}: ${r.plateNumber} - ${r.status}`); g.fields['Parking Activity']=a;}));

  const out=[];
  for (const g of groups.values()) {
    if (!g.guardId || !Object.keys(g.fields).length) continue;
    g.fields['Activity Date']=g.day;
    const filter={companyID:String(companyId),postSiteId:String(postSiteId),guardId:g.guardId,systemGenerated:true,systemReportType:'daily_guard_activity',systemDateKey:g.day};
    const doc=await MobileReport.findOneAndUpdate(filter,{$set:{title:`Daily Guard Activity - ${g.guardName} - ${g.day}`,category:'log',fields:g.fields,userId:g.guardId,fullname:g.guardName,status:true,postSiteId:String(postSiteId)}},{new:true,upsert:true,setDefaultsOnInsert:true});
    out.push(doc);
  }
  return out;
}

/////////////////////////SENDING REPORT//////////////////////////////////


// HELPER FUNCTIONS FOR SHEDULED REPORT START>>>>>>>>>
function addFrequency(date, frequency) {
  const d = new Date(date);

  if (frequency === "5min") {
    d.setMinutes(d.getMinutes() + 5);
    return d;
  }

  if (frequency === "10min") {
    d.setMinutes(d.getMinutes() + 10);
    return d;
  }

  if (frequency === "Daily") {
    d.setDate(d.getDate() + 1);
    return d;
  }

  if (frequency === "Weekly") {
    d.setDate(d.getDate() + 7);
    return d;
  }

  if (frequency === "Monthly") {
    d.setMonth(d.getMonth() + 1);
    return d;
  }

  throw new Error(`Unsupported frequency: ${frequency}`);
}

function getFirstNextSendAt(startDate, frequency) {
  const start = new Date(startDate);
  return addFrequency(start, frequency);
}

function getScheduleWindow(schedule, now = new Date()) {
  const periodEnd = new Date(now);

  let periodStart;
  if (schedule.lastSentAt) {
    periodStart = new Date(schedule.lastSentAt);
  } else {
    periodStart = new Date(schedule.startDate);
  }

  return { periodStart, periodEnd };
}
// HELPER FUNCTION END



async function createPublicBatchAndSendEmail({
  clientName,
  clientEmail,
  reportTitle,
  reports,
  frequency,
  startDate,
  endDate,
  baseUrl,
}) {
  if (!reports || !reports.length) {
    throw new Error("No reports to send.");
  }

  const emailRecipients = Array.isArray(clientEmail)
    ? clientEmail.map(e => String(e).trim().toLowerCase()).filter(Boolean)
    : [String(clientEmail || "").trim().toLowerCase()].filter(Boolean);

  if (!emailRecipients.length) {
    throw new Error("No recipient email found.");
  }

  const mainRecipient = emailRecipients[0];
  const ccRecipients = emailRecipients.slice(1);

  const token = crypto.randomBytes(32).toString("hex");

  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 30);

  await PublicReportBatch.create({
    token,
    reportIds: reports.map((r) => r._id),
    clientEmail: mainRecipient,
    ccRecipients: ccRecipients,
    title: reportTitle,
    expiresAt: expiry,
  });

  const publicReportLink = `${baseUrl}/public/reports/${token}`;

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    requireTLS: true,
    tls: {
      rejectUnauthorized: true,
      servername: "smtp.gmail.com",
    },
    auth: {
      user: process.env.SERVER_EMAIL,
      pass: process.env.SERVER_PASSWORD,
    },
  });

  const reportListHtml = reports
    .map((report, index) => {
      const createdAtText = report.createdAt
        ? new Date(report.createdAt).toLocaleString()
        : "N/A";

      return `
        <tr>
          <td style="padding:10px 12px;border:1px solid #e2e8f0;">${index + 1}</td>
          <td style="padding:10px 12px;border:1px solid #e2e8f0;">${escapeHtml(report.title || "Untitled Report")}</td>
          <td style="padding:10px 12px;border:1px solid #e2e8f0;">${escapeHtml(report.category || "general")}</td>
          <td style="padding:10px 12px;border:1px solid #e2e8f0;">${escapeHtml(createdAtText)}</td>
        </tr>
      `;
    })
    .join("");

  const html = `
    <div style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;">
      <div style="max-width:680px;margin:0 auto;padding:32px 16px;">
        <div style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.08);">
          <div style="background:linear-gradient(135deg,#0d6efd,#1aa3ff);padding:28px 32px;color:#ffffff;">
            <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.9;">Security Report</div>
            <h1 style="margin:10px 0 0;font-size:26px;line-height:1.3;">${escapeHtml(reportTitle)}</h1>
          </div>

          <div style="padding:32px;">
            <p style="margin:0 0 16px;font-size:15px;color:#334155;">Hello ${escapeHtml(clientName || "Client")},</p>

            <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#475569;">
              Your report package is ready. Please use the button below to view the report${reports.length > 1 ? "s" : ""} online.
            </p>

            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;margin-bottom:24px;">
              <div style="margin-bottom:10px;font-size:14px;color:#64748b;"><strong>Report Title:</strong> ${escapeHtml(reportTitle)}</div>
              <div style="margin-bottom:10px;font-size:14px;color:#64748b;"><strong>Frequency:</strong> ${escapeHtml(frequency || "Manual")}</div>
              <div style="margin-bottom:10px;font-size:14px;color:#64748b;"><strong>Date Range:</strong> ${escapeHtml(new Date(startDate).toLocaleString())} to ${escapeHtml(new Date(endDate).toLocaleString())}</div>
              <div style="font-size:14px;color:#64748b;"><strong>Total Reports:</strong> ${reports.length}</div>
            </div>

            <table style="width:100%;border-collapse:collapse;font-size:13px;">
              <thead>
                <tr style="background:#eff6ff;">
                  <th style="padding:10px 12px;border:1px solid #e2e8f0;text-align:left;">#</th>
                  <th style="padding:10px 12px;border:1px solid #e2e8f0;text-align:left;">Report Name</th>
                  <th style="padding:10px 12px;border:1px solid #e2e8f0;text-align:left;">Incident Type</th>
                  <th style="padding:10px 12px;border:1px solid #e2e8f0;text-align:left;">Date</th>
                </tr>
              </thead>
              <tbody>${reportListHtml}</tbody>
            </table>

            <div style="margin:28px 0;text-align:center;">
              <a href="${publicReportLink}"
                 style="display:inline-block;background:#0d6efd;color:#ffffff;text-decoration:none;padding:14px 26px;border-radius:10px;font-size:15px;font-weight:700;">
                View Report${reports.length > 1 ? "s" : ""}
              </a>
            </div>

            <p style="margin:0;font-size:13px;word-break:break-all;color:#0d6efd;">
              ${publicReportLink}
            </p>
          </div>

          <div style="padding:18px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">
            This email was generated by your reporting system.
          </div>
        </div>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.WATCHTEAM_EMAIL_FROM || "Watch Team Security <Secure@watch_team.com>",
    
    to: mainRecipient,
    cc: ccRecipients.length ? ccRecipients.join(",") : undefined,
    subject: reportTitle,
    html,
  });

  return { token };
}
// SHEDULED REPORT ENDS HERE


// helper
function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


// ROUTE TO FETCH REPORT DATE RANGE
app.get("/reports-by-date-range", async (req, res) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { postSiteId, startDate, endDate } = req.query;

    if (!postSiteId || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: "Missing required query params." });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const reports = await MobileReport.find({
      "fields.postSiteId": String(postSiteId),
      createdAt: { $gte: start, $lte: end }
    }).sort({ createdAt: -1 });

    return res.json({
      success: true,
      reports: reports.map(r => ({
        _id: String(r._id),
        title: r.title || "Untitled Report",
        category: r.category || "general",
        createdAt: r.createdAt,
        createdAtText: r.createdAt ? new Date(r.createdAt).toLocaleString() : "N/A"
      }))
    });
  } catch (err) {
    console.error("GET /reports-by-date-range error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});


// REPORT---------------
// app.post("/send-post-site-report", async (req, res) => {
//   try {
//     if (!req.isAuthenticated || !req.isAuthenticated()) {
//       return res.redirect("/sign-in");
//     }

//     const {
//       clientName,
//       clientEmail,
//       reportTitle,
//       reportIds,
//       startDate,
//       endDate,
//       frequency,
//       postSiteId
//     } = req.body;

//     const ids = String(reportIds || "")
//       .split(",")
//       .map(v => v.trim())
//       .filter(Boolean);

//     if (!clientEmail || !reportTitle || !startDate || !endDate || !ids.length) {
//       return res.status(400).send("Missing required fields.");
//     }

//     const reports = await MobileReport.find({
//       _id: { $in: ids }
//     }).select("_id title category createdAt fields");

//     if (!reports || !reports.length) {
//       return res.status(404).send("No reports found.");
//     }

//     const token = crypto.randomBytes(32).toString("hex");

//     const expiry = new Date();
//     expiry.setDate(expiry.getDate() + 30);

//     await PublicReportBatch.create({
//       token,
//       reportIds: reports.map(r => r._id),
//       clientEmail,
//       title: reportTitle,
//       expiresAt: expiry,
//     });

//     const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
//     const publicReportLink = `${baseUrl}/public/reports/${token}`;

//     const transporter = nodemailer.createTransport({
//       host: "smtp.gmail.com",
//       port: 587,
//       secure: false,
//       auth: {
//         user: "surerealintegratedserviceltd@gmail.com",
//         pass: "vvheoqjyhbksmffr"
//       },
//       tls: {
//         rejectUnauthorized: false
//       }
//     });

//     const subject = reportTitle;

//     const reportListHtml = reports.map((report, index) => {
//       const createdAtText = report.createdAt
//         ? new Date(report.createdAt).toLocaleString()
//         : "N/A";

//       return `
//         <tr>
//           <td style="padding:10px 12px;border:1px solid #e2e8f0;">${index + 1}</td>
//           <td style="padding:10px 12px;border:1px solid #e2e8f0;">${escapeHtml(report.title || "Untitled Report")}</td>
//           <td style="padding:10px 12px;border:1px solid #e2e8f0;">${escapeHtml(report.category || "general")}</td>
//           <td style="padding:10px 12px;border:1px solid #e2e8f0;">${escapeHtml(createdAtText)}</td>
//         </tr>
//       `;
//     }).join("");

//     const html = `
//       <div style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;">
//         <div style="max-width:680px;margin:0 auto;padding:32px 16px;">
//           <div style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.08);">
//             <div style="background:linear-gradient(135deg,#0d6efd,#1aa3ff);padding:28px 32px;color:#ffffff;">
//               <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.9;">Security Report</div>
//               <h1 style="margin:10px 0 0;font-size:26px;line-height:1.3;">${escapeHtml(reportTitle)}</h1>
//             </div>

//             <div style="padding:32px;">
//               <p style="margin:0 0 16px;font-size:15px;color:#334155;">Hello ${escapeHtml(clientName || "Client")},</p>

//               <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#475569;">
//                 Your requested report package is ready. Please use the button below to view the report${reports.length > 1 ? "s" : ""} online.
//               </p>

//               <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;margin-bottom:24px;">
//                 <div style="margin-bottom:10px;font-size:14px;color:#64748b;"><strong>Report Title:</strong> ${escapeHtml(reportTitle)}</div>
//                 <div style="margin-bottom:10px;font-size:14px;color:#64748b;"><strong>Frequency:</strong> ${escapeHtml(frequency || "Manual")}</div>
//                 <div style="margin-bottom:10px;font-size:14px;color:#64748b;"><strong>Date Range:</strong> ${escapeHtml(startDate)} to ${escapeHtml(endDate)}</div>
//                 <div style="font-size:14px;color:#64748b;"><strong>Total Reports:</strong> ${reports.length}</div>
//               </div>

//               <div style="margin-bottom:24px;">
//                 <table style="width:100%;border-collapse:collapse;font-size:13px;">
//                   <thead>
//                     <tr style="background:#eff6ff;">
//                       <th style="padding:10px 12px;border:1px solid #e2e8f0;text-align:left;">#</th>
//                       <th style="padding:10px 12px;border:1px solid #e2e8f0;text-align:left;">Report Name</th>
//                       <th style="padding:10px 12px;border:1px solid #e2e8f0;text-align:left;">Incident Type</th>
//                       <th style="padding:10px 12px;border:1px solid #e2e8f0;text-align:left;">Date</th>
//                     </tr>
//                   </thead>
//                   <tbody>
//                     ${reportListHtml}
//                   </tbody>
//                 </table>
//               </div>

//               <div style="margin:28px 0;text-align:center;">
//                 <a href="${publicReportLink}"
//                    style="display:inline-block;background:#0d6efd;color:#ffffff;text-decoration:none;padding:14px 26px;border-radius:10px;font-size:15px;font-weight:700;">
//                   View Report${reports.length > 1 ? "s" : ""}
//                 </a>
//               </div>

//               <p style="margin:24px 0 8px;font-size:13px;color:#64748b;line-height:1.7;">
//                 If the button above does not work, copy and paste this link into your browser:
//               </p>
//               <p style="margin:0;font-size:13px;word-break:break-all;color:#0d6efd;">
//                 ${publicReportLink}
//               </p>
//             </div>

//             <div style="padding:18px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">
//               This email was generated by your reporting system.
//             </div>
//           </div>
//         </div>
//       </div>
//     `;

//     await transporter.sendMail({
//       from: process.env.MAIL_FROM || "surerealintegratedserviceltd@gmail.com",
//       to: clientEmail,
//       subject,
//       html,
//     });

//     console.log(`Report email sent successfully to ${clientEmail}`);
//     return res.redirect("/view-post-site?success=report_sent");
//   } catch (err) {
//     console.error("POST /send-post-site-report error:", err);
//     return res.redirect("/view-post-site?error=report_failed");
//   }
// });
// MADE TO USE THE HELPER FUNCTION REPORT
// app.post("/send-post-site-report", async (req, res) => {
//   try {
//     if (!req.isAuthenticated || !req.isAuthenticated()) {
//       return res.redirect("/sign-in");
//     }

//     const {
//       clientName,
//       clientEmail,
//       reportTitle,
//       reportIds,
//       startDate,
//       endDate,
//       frequency,
//     } = req.body;

//     const ids = String(reportIds || "")
//       .split(",")
//       .map((v) => v.trim())
//       .filter(Boolean);

//     if (!clientEmail || !reportTitle || !startDate || !endDate || !ids.length) {
//       return res.status(400).send("Missing required fields.");
//     }

//     const reports = await MobileReport.find({
//       _id: { $in: ids },
//     }).select("_id title category createdAt fields");

//     if (!reports || !reports.length) {
//       return res.status(404).send("No reports found.");
//     }

//     const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;

//     await createPublicBatchAndSendEmail({
//       clientName,
//       clientEmail,
//       reportTitle,
//       reports,
//       frequency,
//       startDate,
//       endDate,
//       baseUrl,
//     });

//     console.log(`Report email sent successfully to ${clientEmail}`);
//     return res.redirect("/view-post-site?success=report_sent");
//   } catch (err) {
//     console.error("POST /send-post-site-report error:", err);
//     return res.redirect("/view-post-site?error=report_failed");
//   }
// });
app.post("/send-post-site-report", async (req, res) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.redirect("/sign-in");
    }

    const {
      clientName,
      clientEmail,
      reportTitle,
      reportIds,
      startDate,
      endDate,
      frequency,
      postSiteId,
      extraRecipients,
    } = req.body;

    let parsedExtraRecipients = [];

    try {
      parsedExtraRecipients = JSON.parse(extraRecipients || "[]");
    } catch (err) {
      parsedExtraRecipients = [];
    }

    parsedExtraRecipients = parsedExtraRecipients
      .map((email) => String(email).trim().toLowerCase())
      .filter(Boolean);

    const ids = String(reportIds || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

    if (!clientEmail || !reportTitle || !startDate || !endDate || !postSiteId) {
      return res.status(400).send("Missing required fields.");
    }

    const saveResult = await Company.updateOne(
      {
        _id: req.user.assignedCompanyID,
        "postSite._id": postSiteId,
      },
      {
        $set: {
          "postSite.$.reportRecipients": parsedExtraRecipients,
        },
      }
    );

    console.log("Recipient save result:", saveResult);

    const allRecipients = [
      String(clientEmail || "").trim().toLowerCase(),
      ...parsedExtraRecipients,
    ].filter(Boolean);

    const selectedReports = await MobileReport.find({
      _id: { $in: ids },
    }).select("_id title category createdAt fields fullname");
    const activityReports = await buildOperationalActivityReports({
      companyId: String(req.user.assignedCompanyID), postSiteId: String(postSiteId), startDate, endDate
    });
    const reports = [...selectedReports, ...activityReports];

    if (!reports || !reports.length) {
      return res.status(404).send("No reports found.");
    }

    const baseUrl =
      process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;

    await createPublicBatchAndSendEmail({
      clientName,
      clientEmail: allRecipients,
      reportTitle,
      reports,
      frequency,
      startDate,
      endDate,
      baseUrl,
    });

    console.log(`Report email sent successfully to ${allRecipients.join(", ")}`);
    return res.redirect("/view-post-site?success=report_sent");
  } catch (err) {
    console.error("POST /send-post-site-report error:", err);
    return res.redirect("/view-post-site?error=report_failed");
  }
});


// SHEDULE REPORT ROUTE
// app.post("/schedule-post-site-report", async (req, res) => {
//   try {
//     if (!req.isAuthenticated || !req.isAuthenticated()) {
//       return res.redirect("/sign-in");
//     }

//     const {
//       clientName,
//       clientEmail,
//       reportTitle,
//       frequency,
//       startDate,
//       postSiteId,
//     } = req.body;

//     if (!clientEmail || !frequency || !startDate || !postSiteId) {
//       return res.redirect("/view-post-site?error=report_failed");
//     }
// // test code in min
//     if (!["5min", "10min", "Daily", "Weekly", "Monthly"].includes(frequency)) {
//   return res.redirect("/view-post-site?error=report_failed");
// }

//     const parsedStartDate = new Date(startDate);
//     if (Number.isNaN(parsedStartDate.getTime())) {
//       return res.redirect("/view-post-site?error=report_failed");
//     }

//     const nextSendAt = getFirstNextSendAt(parsedStartDate, frequency);

//     await ScheduledPostSiteReport.findOneAndUpdate(
//       {
//         companyId: String(req.user.assignedCompanyID),
//         postSiteId: String(postSiteId),
//         clientEmail: String(clientEmail).trim().toLowerCase(),
//       },
//       {
//         $set: {
//           companyId: String(req.user.assignedCompanyID),
//           postSiteId: String(postSiteId),
//           clientName: clientName || "",
//           clientEmail: String(clientEmail).trim().toLowerCase(),
//           reportTitle: reportTitle || "Scheduled Site Report",
//           frequency,
//           startDate: parsedStartDate,
//           nextSendAt,
//           isActive: true,
//         },
//       },
//       { upsert: true, new: true }
//     );

//     return res.redirect("/view-post-site?success=report_scheduled");
//   } catch (err) {
//     console.error("POST /schedule-post-site-report error:", err);
//     return res.redirect("/view-post-site?error=report_failed");
//   }
// });
app.post("/schedule-post-site-report", async (req, res) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.redirect("/sign-in");
    }

    const {
      clientName,
      clientEmail,
      reportTitle,
      frequency,
      startDate,
      postSiteId,
      extraRecipients,
    } = req.body;

    let parsedExtraRecipients = [];

    try {
      parsedExtraRecipients = JSON.parse(extraRecipients || "[]");
    } catch (err) {
      parsedExtraRecipients = [];
    }

    parsedExtraRecipients = parsedExtraRecipients
      .map((email) => String(email).trim().toLowerCase())
      .filter(Boolean);
await Company.updateOne(
  {
    _id: req.user.assignedCompanyID,
    "postSite._id": postSiteId
  },
  {
    $set: {
      "postSite.$.reportRecipients": parsedExtraRecipients
    }
  }
);


    if (!clientEmail || !frequency || !startDate || !postSiteId) {
      return res.redirect("/view-post-site?error=report_failed");
    }

    if (!["5min", "10min", "Daily", "Weekly", "Monthly"].includes(frequency)) {
      return res.redirect("/view-post-site?error=report_failed");
    }

    const parsedStartDate = new Date(startDate);

    if (Number.isNaN(parsedStartDate.getTime())) {
      return res.redirect("/view-post-site?error=report_failed");
    }

    const nextSendAt = getFirstNextSendAt(parsedStartDate, frequency);

    await ScheduledPostSiteReport.findOneAndUpdate(
      {
        companyId: String(req.user.assignedCompanyID),
        postSiteId: String(postSiteId),
        clientEmail: String(clientEmail).trim().toLowerCase(),
      },
      {
        $set: {
          companyId: String(req.user.assignedCompanyID),
          postSiteId: String(postSiteId),
          clientName: clientName || "",
          clientEmail: String(clientEmail).trim().toLowerCase(),
          extraRecipients: parsedExtraRecipients,
          reportTitle: reportTitle || "Scheduled Site Report",
          frequency,
          startDate: parsedStartDate,
          nextSendAt,
          isActive: true,
        },
      },
      { upsert: true, new: true }
    );

    return res.redirect("/view-post-site?success=report_scheduled");
  } catch (err) {
    console.error("POST /schedule-post-site-report error:", err);
    return res.redirect("/view-post-site?error=report_failed");
  }
});


// DISBALE SHEDULED REPORT
app.post("/disable-scheduled-post-site-report", async (req, res) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.redirect("/sign-in");
    }

    const { postSiteId, clientEmail } = req.body;

    await ScheduledPostSiteReport.findOneAndUpdate(
      {
        companyId: String(req.user.assignedCompanyID),
        postSiteId: String(postSiteId),
        clientEmail: String(clientEmail).trim().toLowerCase(),
      },
      {
        $set: {
          isActive: false,
        },
      }
    );

    return res.redirect("/view-post-site?success=report_scheduled");
  } catch (err) {
    console.error("POST /disable-scheduled-post-site-report error:", err);
    return res.redirect("/view-post-site?error=report_failed");
  }
});


// HHISTORY AND LOGS FOR SEND SHEDULED REPORT
app.get("/scheduled-post-site-report-history", async (req, res) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { postSiteId, clientEmail } = req.query;

    if (!postSiteId || !clientEmail) {
      return res.status(400).json({ success: false, message: "Missing required query params." });
    }

    const schedule = await ScheduledPostSiteReport.findOne({
      companyId: String(req.user.assignedCompanyID),
      postSiteId: String(postSiteId),
      clientEmail: String(clientEmail).trim().toLowerCase(),
    });

    if (!schedule) {
      return res.json({ success: true, logs: [] });
    }

    const logs = await ScheduledPostSiteReportLog.find({
      scheduleId: schedule._id,
    })
      .sort({ sentAt: -1 })
      .lean();

    return res.json({
      success: true,
      logs: logs.map((log) => ({
        _id: String(log._id),
        status: log.status,
        reportCount: log.reportCount,
        frequency: log.frequency,
        periodStart: log.periodStart,
        periodEnd: log.periodEnd,
        sentAt: log.sentAt,
        errorMessage: log.errorMessage || "",
      })),
    });
  } catch (err) {
    console.error("GET /scheduled-post-site-report-history error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});


// LINK CLIENT CLICK TO//
app.get("/public/reports/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const batch = await PublicReportBatch.findOne({ token }).populate("reportIds");

    if (!batch) {
      return res.status(404).send("Report batch not found.");
    }

    if (batch.expiresAt && new Date() > new Date(batch.expiresAt)) {
      return res.status(410).send("This report link has expired.");
    }

    const reports = Array.isArray(batch.reportIds) ? batch.reportIds : [];

    if (!reports.length) {
      return res.status(404).send("No reports found in this batch.");
    }

    if (reports.length === 1) {
      return res.render("public/public-report-view", {
        layout: false,
        report: reports[0],
      });
    }

    return res.render("public/public-report-list", {
      layout: false,
      batch,
      reports,
    });
  } catch (err) {
    console.error("GET /public/reports/:token error:", err);
    return res.status(500).send("Unable to load reports.");
  }
});

// route to open one report from the list
app.get("/public/report/item/:reportId", async (req, res) => {
  try {
    const { reportId } = req.params;
    const { token } = req.query;

    const batch = await PublicReportBatch.findOne({ token });
    if (!batch) {
      return res.status(404).send("Invalid report access.");
    }

    const isAllowed = batch.reportIds.some(id => String(id._id || id) === String(reportId));
    if (!isAllowed) {
      return res.status(403).send("You do not have access to this report.");
    }

    if (batch.expiresAt && new Date() > new Date(batch.expiresAt)) {
      return res.status(410).send("This report link has expired.");
    }

    const report = await MobileReport.findById(reportId);
    if (!report) {
      return res.status(404).send("Report not found.");
    }

    return res.render("public/public-report-view", {
      layout: false,
      report,
    });
  } catch (err) {
    console.error("GET /public/report/item/:reportId error:", err);
    return res.status(500).send("Unable to load report.");
  }
});

app.get("/public/report/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const report = await MobileReport.findOne({
      publicShareToken: token,
      publicShareEnabled: true,
    });

    if (!report) {
      return res.status(404).send("Report not found or link is invalid.");
    }

    if (report.publicShareExpiresAt && new Date() > new Date(report.publicShareExpiresAt)) {
      return res.status(410).send("This report link has expired.");
    }

    return res.render("public/public-report-view", {
      layout: false,
      report,
    });
  } catch (err) {
    console.error("GET /public/report/:token error:", err);
    return res.status(500).send("Unable to load report.");
  }
});



// CRON JOB KIND FOR SHEDULED REPORT
cron.schedule("* * * * *", async () => {
  console.log("Cron tick:", new Date().toISOString());
  try {
    const now = new Date();

    const dueSchedules = await ScheduledPostSiteReport.find({
      isActive: true,
      nextSendAt: { $lte: now },
    });

    for (const schedule of dueSchedules) {
      console.log("Running schedule for:", schedule.clientEmail);

      const { periodStart, periodEnd } = getScheduleWindow(schedule, now);

      try {
        // 🔍 Get reports within window
        const submittedReports = await MobileReport.find({
          companyID: String(schedule.companyId),
          "fields.postSiteId": String(schedule.postSiteId),
          systemGenerated: { $ne: true },
          createdAt: { $gt: periodStart, $lte: periodEnd },
        }).select("_id title category createdAt fields fullname").sort({ createdAt: -1 });
        const activityReports = await buildOperationalActivityReports({
          companyId: String(schedule.companyId), postSiteId: String(schedule.postSiteId), startDate: periodStart, endDate: periodEnd
        });
        const reports = [...submittedReports, ...activityReports];

        // 🚫 If no reports → SKIP sending
        if (!reports.length) {
          console.log(`No reports found for ${schedule.clientEmail}. Skipping.`);

          await ScheduledPostSiteReportLog.create({
            scheduleId: schedule._id,
            companyId: schedule.companyId,
            postSiteId: schedule.postSiteId,
            clientName: schedule.clientName,
            clientEmail: schedule.clientEmail,
            frequency: schedule.frequency,
            reportTitle: schedule.reportTitle,
            periodStart,
            periodEnd,
            reportCount: 0,
            status: "skipped_no_reports",
            errorMessage: "",
            sentAt: now,
          });

          // 🔁 Move to next cycle (IMPORTANT)
          schedule.lastSentAt = periodEnd;

          try {
            schedule.nextSendAt = addFrequency(schedule.nextSendAt, schedule.frequency);
          } catch (err) {
            console.error("Frequency error (skip path):", err);
            schedule.nextSendAt = addFrequency(new Date(), schedule.frequency);
          }

          await schedule.save();
          continue;
        }

        // 📧 Send email
        const baseUrl = process.env.PUBLIC_BASE_URL || "http://localhost:9000";

        const result = await createPublicBatchAndSendEmail({
          clientName: schedule.clientName,
          clientEmail: schedule.clientEmail,
          reportTitle: schedule.reportTitle || `${schedule.frequency} Site Report`,
          reports,
          frequency: schedule.frequency,
          startDate: periodStart,
          endDate: periodEnd,
          baseUrl,
        });

        console.log(`Email sent to ${schedule.clientEmail}`);

        // 📝 Log success
        await ScheduledPostSiteReportLog.create({
          scheduleId: schedule._id,
          companyId: schedule.companyId,
          postSiteId: schedule.postSiteId,
          clientName: schedule.clientName,
          clientEmail: schedule.clientEmail,
          frequency: schedule.frequency,
          reportTitle: schedule.reportTitle,
          periodStart,
          periodEnd,
          reportCount: reports.length,
          status: "success",
          errorMessage: "",
          batchToken: result.token,
          sentAt: now,
        });

        // 🔁 Update schedule (CRITICAL FOR LOOPING)
        schedule.lastSentAt = periodEnd;

        try {
          const next = addFrequency(schedule.nextSendAt, schedule.frequency);

          // 🛡️ Safety check: avoid stuck schedules
          if (!next || next <= now) {
            console.warn("Invalid nextSendAt detected. Resetting.");
            schedule.nextSendAt = addFrequency(new Date(), schedule.frequency);
          } else {
            schedule.nextSendAt = next;
          }
        } catch (err) {
          console.error("Frequency error (success path):", err);
          schedule.nextSendAt = addFrequency(new Date(), schedule.frequency);
        }

        await schedule.save();
      } catch (innerErr) {
        console.error(`Failed schedule for ${schedule.clientEmail}:`, innerErr);

        // ❌ Log failure
        await ScheduledPostSiteReportLog.create({
          scheduleId: schedule._id,
          companyId: schedule.companyId,
          postSiteId: schedule.postSiteId,
          clientName: schedule.clientName,
          clientEmail: schedule.clientEmail,
          frequency: schedule.frequency,
          reportTitle: schedule.reportTitle,
          periodStart,
          periodEnd,
          reportCount: 0,
          status: "failed",
          errorMessage: innerErr.message || "Unknown error",
          sentAt: now,
        });

        // 🔁 Move forward anyway (avoid infinite retry loop)
        try {
          schedule.nextSendAt = addFrequency(schedule.nextSendAt, schedule.frequency);
        } catch (err) {
          schedule.nextSendAt = addFrequency(new Date(), schedule.frequency);
        }

        await schedule.save();
      }
    }
  } catch (err) {
    console.error("Scheduled report cron error:", err);
  }
});


// EXPORT

module.exports = {
    reminderMail:guardVerify,
    aCreatePass:adminCreatePassword,
    // passwordResetMail:resetPassword,
  }



