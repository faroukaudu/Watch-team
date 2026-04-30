const myModule = require('./index.js');
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const passport = require("passport");
const session = require("express-session");
const _ = require('lodash');
var companyInfo = require(__dirname + "/db/companyinfodb.js");
const { Types } = require('mongoose');
const Report = require( "./src/models/report.js");

const app = myModule.main;
const User = myModule.userDB;
const Company = mongoose.model("Company", companyInfo);


app.post("/guard-signin", (req, res) => {
    const { username, password } = req.body;
    console.log(username, "and this is his role", password);

    req.body.username = _.capitalize(username);
    User.findByUsername(req.body.username).then((mobileUser)=>{
        console.log("This is Mobile"+ mobileUser);
        
        if(mobileUser.userType === "AmobileGuard" && mobileUser.status){
            var userLogin = new User({ username: req.body.username, password: password });
            req.login(userLogin, function (err) {
        if (!err) {
            console.log("UserInfo ISS::", req.user);


            passport.authenticate("local", {

                // successRedirect: "/dashboard",
                failureRedirect: "/error911",
                failureMessage: true
            })(req, res, function () {

                req.session.lastLog = new Date();
                // console.log(req.user);
                //   Redirecting to user Dashboard
                // res.redirect("/dashboard");
                //  res.render("dashboard/dashb");
                res.status(200).json({
                    message: `Welcome ${username}, you have admin access.`,
                    email: username,
                    userId: req.user._id,
                });
            })
        } else {
            // res.render("userdash/animations/usererr", {errorMsg:"Invalid Login Details !!!"});
            res.status(401).json({
                message: 'Unauthorized access.',
            });
        }
    })
        }else{
             res.status(401).json({
                message: 'Unauthorized access.',
            });
            console.log("Only Guards can sign-in");
            
        }


    }).catch((err)=>{
        console.log(err);
         res.status(401).json({
                message: 'Unauthorized access.',
            });
        

    })


});

// var userLogin = new User({ username: req.body.username, password: password });
//     req.login(userLogin, function (err) {
//         if (!err) {
//             console.log("UserInfo ISS::", req.user);


//             passport.authenticate("local", {

//                 // successRedirect: "/dashboard",
//                 failureRedirect: "/error911",
//                 failureMessage: true
//             })(req, res, function () {

//                 req.session.lastLog = new Date();
//                 // console.log(req.user);
//                 //   Redirecting to user Dashboard
//                 // res.redirect("/dashboard");
//                 //  res.render("dashboard/dashb");
//                 res.status(200).json({
//                     message: `Welcome ${username}, you have admin access.`,
//                 });
//             })
//         } else {
//             // res.render("userdash/animations/usererr", {errorMsg:"Invalid Login Details !!!"});
//             res.status(401).json({
//                 message: 'Unauthorized access.',
//             });
//         }
//     })

app.get("/new-guards", async (req,res)=>{

    if(req.isAuthenticated()){
    //    res.render("dashboard/new-guards", {userInfo:req.user});
    // const clients = await Company.find({_id:req.user.assignedCompanyID}).select('postSite').sort({siteName:1});
    const clients = await User.find({assignedCompanyID:req.user.assignedCompanyID,userType:"Client"}).select('fullname').sort({siteName:1});
    console.log("I am reading this", clients);
    res.render("dashboard/new-guards", {userInfo:req.user, myClients:clients}); //postS
    // res.send(clients[0].postSite);
    
    }else{
        res.redirect("/sign-in");
    }
    
})
// clientID: req.params.clientId
app.get('/api/clients/:clientId/sites', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'unauthenticated' });

  try {
    const companyId = new Types.ObjectId(req.user.assignedCompanyID);
    const TARGET = (req.params.clientId || '').trim();

    const result = await Company.aggregate([
      { $match: { _id: companyId } },
      {
        $project: {
          _id: 1,
          sites: {
            $filter: {
              input: '$postSite',
              as: 'ps',
              cond: { $eq: ['$$ps.clientID', TARGET] } // compare as string
            }
          }
        }
      }
      // If you're on MongoDB >= 5.2 and want them sorted by siteName:
      // ,{ $project: { _id: 1, sites: { $sortArray: { input: '$sites', sortBy: { siteName: 1 } } } } }
    ]);

    const sites = result[0]?.sites ?? [];
    return res.json({ sites }); // perfect for your dropdown
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// MOBILE APP API
app.get('/guard-info', (req,res)=>{
    const guardID = req.query.id;
    console.log('Incoming query:', req.query);
    // console.log("My USer Info Email",guardID);

     User.findById(guardID).then((guardInfo)=>{
        console.log("Thiod My Guard", guardInfo);
       Company.findById(guardInfo.assignedCompanyID).then((guardCompany)=>{


        res.status(200).json({
                    guardData:guardInfo,
                    company:guardCompany,
                    // companyInfo:
                });

       }).catch((err)=>{
         res.status(402).json({
                message: 'Cant fetch Guard Company',
            });

       })
     
    }).catch((err)=>{
        res.status(402).json({
                message: 'Cant fetch user info',
            });
    })
    
})

// Gaurd Details Page
app.post("/guard-details", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/sign-in");
  }

  try {
    const guardID = req.body.guard_id;
    console.log("MY Guard ID IS+++++++==>", guardID);

    const guardFound = await User.findById(guardID);

    if (!guardFound) {
      return res.status(404).send("Guard not found");
    }

    console.log("Found a guard ------->", guardFound);
    console.log("Added post sites", guardFound.guardPostSite);

    // ✅ collect all post site IDs
    const postSiteIds = (guardFound.guardPostSite || [])
      .map((p) => p.postSiteID)
      .filter(Boolean)
      .map((id) => new mongoose.Types.ObjectId(id));

    const guardMatch = await Company.aggregate([
      {
        $match: {
          "postSite._id": { $in: postSiteIds }
        }
      },
      {
        $project: {
          companyName: 1,
          postSite: {
            $filter: {
              input: "$postSite",
              as: "p",
              cond: { $in: ["$$p._id", postSiteIds] }
            }
          }
        }
      }
    ]);

    const clients = await User.find({
      assignedCompanyID: req.user.assignedCompanyID,
      userType: "Client"
    })
      .select("fullname")
      .sort({ fullname: 1 });
      console.log("gfound",guardFound);
      console.log("match",guardMatch[0].postSite);
      console.log("clients",clients);
      

    res.render("dashboard/guard-details", {
      userInfo: req.user,
      guardInfo: guardFound,
      site: guardMatch, // now contains all matching companies + post sites
      myClients: clients
    });
  } catch (err) {
    console.error("guard-details error:", err);
    res.status(500).send("Error here");
  }
});


// ReAssign Guard Post



app.post("/reassign-guard-post", (req,res)=>{
  const {siteId, guard_id} = req.body;

  User.findById(guard_id).then((guardFound)=>{
    guardFound.guardPostSite[0].postSiteID = siteId;
    guardFound.save();
    res.redirect("/guards");
  }).catch((err)=>{
    res.send(err);
  });
  
});

// Adding a new post Site to Guard
app.post("/new-guard-postSite", (req,res)=>{
  const {siteId, guard_id} = req.body;

  console.log("I am adding a new post site");
  
  console.log(siteId, guard_id);
  // res.send("Adding");
  const postInfo = {
    siteName:"new-Site",
    postSiteID:siteId,
  };
  

  User.findById(guard_id).then((guardFound)=>{
    guardFound.guardPostSite.push(postInfo);
    guardFound.save();
    res.redirect("/guards");
  }).catch((err)=>{
    res.send(err);
  });
  
});

// DELETE GUARD
app.post("/delete-guard", (req,res)=>{
  User.findByIdAndDelete(req.body.guard_id).then((d)=>{
res.redirect("/guards");
  }).catch((err)=>{
    res.send(err);
  })
});



// BLOCK && UNBLOCK GUARDS--->---->
app.post("/block-guard", (req,res)=>{
  console.log("blocking",req.body.guard_id );
  
    User.findById(req.body.guard_id).then((guardF)=>{
      console.log("this is guard stas",guardF.status);
      
        if(guardF.status == true){
            guardF.status = false;
            guardF.save();
            res.redirect("/guards");
        }else{
            guardF.status = true;
            guardF.save();
            res.redirect("/guards");
        }
        
    }).catch((err)=>{
        res.send(err);
    })
})

// From the Mobil Report

// CHAT API from Mobile
app.get("/api/users", async (req, res) => {
  try {
    const myUserId = (req.headers["x-user-id"] || "").toString().trim();

    if (!myUserId) {
      return res.status(400).json({ ok: false, error: "Missing x-user-id header" });
    }

    const me = await User.findById(myUserId);
    if (!me) {
      return res.status(404).json({ ok: false, error: "Current user not found" });
    }

    const companyId = (me.assignedCompanyID || "").toString();
    if (!companyId) {
      return res.status(400).json({ ok: false, error: "User has no assignedCompanyID" });
    }

    const users = await User.find({
      assignedCompanyID: companyId,
      _id: { $ne: me._id },
      status: true,
    })
      .select("_id fullname email")
      .sort({ fullname: 1 });

    return res.json({ ok: true, users });
  } catch (err) {
    console.error("GET /api/users error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});
