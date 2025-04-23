const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const passport = require("passport");
const session = require("express-session");
const _ = require('lodash');
const app = express();
require('dotenv').config();






app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
//setting Plugins for app 
app.set('view engine', 'ejs');
app.use(express.static("public"));
//setting Plugins for app
// IMPORTS AND HEADS...///////////////////////////////////////////


app.get("/sign-in", (req,res)=>{
    res.render("sign-in");
})

app.get("/sign-up", (req,res)=>{
    res.render("sign-up");
})

app.get("/dashboard", (req,res)=>{
    res.render("dashboard/dashb");
})

app.get("/activities", (req,res)=>{
    res.render("dashboard/activity");
})

app.get("/clients", (req,res)=>{
    res.render("dashboard/clients");
})

app.get("/new-cli", (req,res)=>{
    res.render("dashboard/new-client");
})

app.get("/post-site", (req,res)=>{
    res.render("dashboard/post-site");
})

app.get("/new-post-site", (req,res)=>{
    res.render("dashboard/new-post-site");
})

app.get("/guards", (req,res)=>{
    res.render("dashboard/guards");
})

app.get("/new-guards", (req,res)=>{
    res.render("dashboard/new-guards");
})

app.get("/bo-user", (req,res)=>{
    res.render("dashboard/back-office-user");
})

app.get("/new-bo-user", (req,res)=>{
    res.render("dashboard/new-bo-user");
})

app.get("/report", (req,res)=>{
    res.render("dashboard/report");
})

app.get("/analytics/shedule", (req,res)=>{
    res.render("dashboard/shedule");
})

app.get("/chat", (req,res)=>{
    res.render("dashboard/chat");
})

app.get("/time-log", (req,res)=>{
    res.render("dashboard/time-log");
})

app.get("/breaks", (req,res)=>{
    res.render("dashboard/breaks");
})

app.get("/reports", (req,res)=>{
    res.render("dashboard/reports");
})


app.get("/attendance", (req,res)=>{
    res.render("dashboard/attendance");
})

app.get("/open-shift", (req,res)=>{
    res.render("dashboard/open-shift");
})

app.get("/shift-ex", (req,res)=>{
    res.render("dashboard/shift-ex");
})


app.get("/time-off", (req,res)=>{
    res.render("dashboard/time-off");
})

app.get("/time-off", (req,res)=>{
    res.render("dashboard/time-off");
})

app.get("/gen-payroll", (req,res)=>{
    res.render("dashboard/run-payroll");
})

app.get("/past-payroll", (req,res)=>{
    res.render("dashboard/past-payroll");
})




app.get("/test", (req,res)=>{
    res.render("dashboard/test");
})





module.exports = {
    main:app,
    // userDB:User,

  }