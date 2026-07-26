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


app.post("/guard-signin", async (req, res, next) => {
  console.log("==================================");
  console.log("GUARD LOGIN ROUTE HIT");
  console.log("MOBILE API FILE:", __filename);
  console.log("SERVER WORKING DIRECTORY:", process.cwd());
  console.log("==================================");

  try {
    const rawUsername = String(
      req.body.username || req.body.email || ""
    ).trim();

    const password = String(req.body.password || "");

    console.log(
      "RAW USERNAME:",
      JSON.stringify(rawUsername)
    );

    console.log(
      "USERNAME LENGTH:",
      rawUsername.length
    );

    console.log(
      "PASSWORD PROVIDED:",
      password.length > 0
    );

    if (!rawUsername || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required.",
      });
    }

    /*
     * Do not capitalize or otherwise change the username.
     * Your database stores the username in lowercase.
     */
    const cleanUsername = _.capitalize(rawUsername);

    const mobileUser = await User.findByUsername(
      cleanUsername
    );

    if (!mobileUser) {
      console.log(
        "LOGIN FAILED: Guard account not found:",
        cleanUsername
      );

      return res.status(401).json({
        success: false,
        message: "Incorrect username or password.",
      });
    }

    console.log("MOBILE GUARD FOUND:", {
      id: mobileUser._id.toString(),
      username: mobileUser.username,
      userType: mobileUser.userType,
      status: mobileUser.status,
      isBlocked: mobileUser.isBlocked,
      hasSalt: Boolean(mobileUser.salt),
      hasHash: Boolean(mobileUser.hash),
    });

    if (mobileUser.userType !== "AmobileGuard") {
      return res.status(403).json({
        success: false,
        message: "Only mobile guards can sign in.",
      });
    }

    if (
      mobileUser.status === false ||
      mobileUser.isBlocked === true
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Your account is inactive. Please contact your administrator.",
      });
    }

    /*
     * Passport must receive the exact username stored
     * in the database.
     */
    req.body.username = mobileUser.username;
    req.body.password = password;

    passport.authenticate(
      "local",
      (err, user, info) => {
        if (err) {
          console.error(
            "PASSPORT AUTHENTICATION ERROR:",
            err
          );

          return next(err);
        }

        if (!user) {
          console.log(
            "PASSPORT REJECTED LOGIN:",
            info
          );

          return res.status(401).json({
            success: false,
            message: "Incorrect username or password.",
          });
        }

        req.login(user, (loginErr) => {
          if (loginErr) {
            console.error(
              "SESSION LOGIN ERROR:",
              loginErr
            );

            return next(loginErr);
          }

          req.session.lastLog = new Date();

          /*
           * Save the session before returning success.
           */
          req.session.save((sessionError) => {
            if (sessionError) {
              console.error(
                "SESSION SAVE ERROR:",
                sessionError
              );

              return next(sessionError);
            }

            console.log(
              "MOBILE GUARD LOGIN SUCCESSFUL:",
              user.username
            );

            return res.status(200).json({
              success: true,
              message: `Welcome ${
                user.fullname || user.username
              }. Login successful.`,
              email: user.email || user.username,
              username: user.username,
              userId: user._id.toString(),
              fullname: user.fullname || "",
              userType: user.userType,
              assignedCompanyID:
                user.assignedCompanyID || "",
            });
          });
        });
      }
    )(req, res, next);
  } catch (error) {
    console.error(
      "GUARD SIGN-IN ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server error. Please try again.",
    });
  }
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
  console.log("this is the guard", req.body.guard_id);
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


// MOBILE APP API: Post Site Contacts + Security Team
app.get("/api/mobile/post-site-directory", async (req, res) => {
  try {
    const { companyId, postSiteId } = req.query;

    if (!companyId || !postSiteId) {
      return res.status(400).json({
        success: false,
        message: "companyId and postSiteId are required.",
      });
    }

    const siteObjectId = mongoose.Types.ObjectId.isValid(postSiteId)
      ? new mongoose.Types.ObjectId(postSiteId)
      : postSiteId;

    const company = await Company.findOne(
      {
        _id: companyId,
        "postSite._id": siteObjectId,
      },
      {
        companyName: 1,
        postSite: { $elemMatch: { _id: siteObjectId } },
      }
    ).lean();

    if (!company || !company.postSite || company.postSite.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Post site not found.",
      });
    }

    const site = company.postSite[0];

    const guards = await User.find({
      assignedCompanyID: String(companyId),
      userType: "AmobileGuard",
      guardPostSite: {
        $elemMatch: {
          postSiteID: String(postSiteId),
        },
      },
    })
      .select("fullname username email phone status guardPostSite")
      .sort({ fullname: 1 })
      .lean();

    let client = null;

    if (site.clientID) {
      client = await User.findById(site.clientID)
        .select("fullname username email phone status userType")
        .lean();
    }

    return res.status(200).json({
      success: true,
      postSite: {
        id: site._id,
        siteName: site.siteName,
        address: site.address,
        clientID: site.clientID,
        clientName: site.clientName,
      },
      client,
      guards,
    });
  } catch (error) {
    console.error("post-site-directory error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error fetching post site directory.",
    });
  }
});


// 1. Phone-number login route
function normalizePhoneNumber(value = "") {
  return String(value)
    .trim()
    .replace(/[^\d+]/g, "");
}

function authenticateGuardPassword(user, password) {
  return new Promise((resolve, reject) => {
    user.authenticate(password, (error, authenticatedUser) => {
      if (error) {
        return reject(error);
      }

      resolve(authenticatedUser || null);
    });
  });
}

app.post("/guard-phone-signin", async (req, res, next) => {
  try {
    const phone = normalizePhoneNumber(req.body.phone);
    const password = String(req.body.password || "");

    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Phone number and password are required.",
      });
    }

    /*
     * Phone numbers may previously have been saved with spaces,
     * dashes, brackets, or without a country-code plus sign.
     *
     * Fetch mobile guards and normalize their phone numbers in code
     * so old records can still match.
     */
    const guards = await User.find({
      userType: "AmobileGuard",
    });

    const phoneMatches = guards.filter((guard) => {
      return normalizePhoneNumber(guard.phone) === phone;
    });

    if (phoneMatches.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Incorrect phone number or password.",
      });
    }

    const authenticatedGuards = [];

    for (const guard of phoneMatches) {
      const authenticatedGuard =
        await authenticateGuardPassword(guard, password);

      if (authenticatedGuard) {
        authenticatedGuards.push(authenticatedGuard);
      }
    }

    if (authenticatedGuards.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Incorrect phone number or password.",
      });
    }

    const activeGuards = authenticatedGuards.filter(
      (guard) => guard.status === true
    );

    if (activeGuards.length === 0) {
      return res.status(403).json({
        success: false,
        message:
          "The matching account is inactive. Please contact your administrator.",
      });
    }

    /*
     * Only one account matches, so complete login immediately.
     */
    if (activeGuards.length === 1) {
      const guard = activeGuards[0];

      return req.login(guard, (loginError) => {
        if (loginError) {
          return next(loginError);
        }

        req.session.lastLog = new Date();

        return res.status(200).json({
          success: true,
          requiresAccountSelection: false,
          message: `Welcome ${guard.fullname || guard.username}.`,
          userId: guard._id,
          username: guard.username,
          fullname: guard.fullname,
          phone: guard.phone,
          assignedCompanyID: guard.assignedCompanyID,
          guardPostSite: guard.guardPostSite || [],
        });
      });
    }

    /*
     * More than one guard has the same phone and password.
     * Store the verified IDs temporarily in the session.
     *
     * This prevents someone from submitting an arbitrary user ID
     * in the second request.
     */
    req.session.pendingGuardPhoneLogin = {
      userIds: activeGuards.map((guard) =>
        String(guard._id)
      ),
      expiresAt: Date.now() + 5 * 60 * 1000,
    };

    return res.status(200).json({
      success: true,
      requiresAccountSelection: true,
      message:
        "Multiple guard accounts use these login details. Select your account.",
      accounts: activeGuards.map((guard) => ({
        userId: guard._id,
        fullname:
          guard.fullname ||
          guard.username ||
          "Guard Account",
        username: guard.username,
        phone: guard.phone,
        assignedCompanyID: guard.assignedCompanyID,
        guardPostSite: guard.guardPostSite || [],
      })),
    });
  } catch (error) {
    console.error("Guard phone sign-in error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error. Please try again.",
    });
  }
});

app.post(
  "/guard-phone-signin/select-account",
  async (req, res, next) => {
    try {
      const userId = String(req.body.userId || "").trim();

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "Please select a guard account.",
        });
      }

      const pendingLogin =
        req.session.pendingGuardPhoneLogin;

      if (
        !pendingLogin ||
        !Array.isArray(pendingLogin.userIds)
      ) {
        return res.status(401).json({
          success: false,
          message:
            "Your login selection has expired. Please sign in again.",
        });
      }

      if (
        !pendingLogin.expiresAt ||
        Date.now() > pendingLogin.expiresAt
      ) {
        delete req.session.pendingGuardPhoneLogin;

        return res.status(401).json({
          success: false,
          message:
            "Your login selection has expired. Please sign in again.",
        });
      }

      if (!pendingLogin.userIds.includes(userId)) {
        return res.status(403).json({
          success: false,
          message: "This guard account was not verified.",
        });
      }

      const guard = await User.findById(userId);

      if (!guard) {
        return res.status(404).json({
          success: false,
          message: "Guard account not found.",
        });
      }

      if (guard.userType !== "AmobileGuard") {
        return res.status(403).json({
          success: false,
          message: "Only mobile guards can sign in.",
        });
      }

      if (!guard.status) {
        return res.status(403).json({
          success: false,
          message:
            "Your account is inactive. Please contact your administrator.",
        });
      }

      return req.login(guard, (loginError) => {
        if (loginError) {
          return next(loginError);
        }

        delete req.session.pendingGuardPhoneLogin;
        req.session.lastLog = new Date();

        return res.status(200).json({
          success: true,
          requiresAccountSelection: false,
          message: `Welcome ${guard.fullname || guard.username}.`,
          userId: guard._id,
          username: guard.username,
          fullname: guard.fullname,
          phone: guard.phone,
          assignedCompanyID: guard.assignedCompanyID,
          guardPostSite: guard.guardPostSite || [],
        });
      });
    } catch (error) {
      console.error(
        "Guard phone account-selection error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Server error. Please try again.",
      });
    }
  }
);


