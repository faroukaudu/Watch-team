const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const passport = require("passport");
const session = require("express-session");
const passportLocalMongoose = require("passport-local-mongoose");
const attachSubscription = require("./src/middleware/attachSubscription");
const { requireActiveSubscription, requireFeature, requireNumericFeature } = require("./src/middleware/requireSubscription");
const { getResolvedFeatures, getLimitValue, isUnlimited } = require("./src/utils/subscriptionLimits");
const { isClientUser, getClientScope } = require("./src/utils/clientScope");
var userschema = require(__dirname + "/db/userdb.js");
var db = require(__dirname + "/db/connection.js");
const timeAgo = require(__dirname + "/middleware/timeAgo.js")
require('dotenv').config();
// const billingRoutes = require("./src/routes/billing.js");
const cors = require("cors");
const { MongoStore } = require("connect-mongo");

// const appDb = require("./middleware/appDb");
// const registerStrategy = require("./middleware/passportConfig");
const _ = require('lodash');
const app = express();
require('dotenv').config();
// const billingRoutes = require("../src/routes/billing.js");
var companyInfo = require(__dirname + "/db/companyinfodb.js");
// var messageSchema = require(__dirname + "/db/messagedb.js");
app.locals.timeAgo = timeAgo; // Make it a GLobally Accessable in all EJS temp.
// const clientSchema = require("./db/clientDb");
const Message = require(__dirname + "/db/messagedb.js");
const Chat = require(__dirname + "/db/chatdb.js");

const registerReportRoutes = require("./src/routes/reports");
const registerUploadRoutes = require("./src/routes/uploads");
const { registerUserRoutes } = require("./routes/chat_api");



// Initialize models
function buildDirectKey(companyId, a, b) {
    const ids = [String(a), String(b)].sort(); // stable order
    return `${companyId}:${ids[0]}:${ids[1]}`;
}
// DB
app.use(cors());
app.use("/webhooks/stripe", require("express").raw({ type: "application/json" }));
app.use(express.json({ limit: "2mb" }));
app.use(bodyParser.urlencoded({ extended: true }));
// app.use(billingRoutes);

// after app.use(express.json()) etc:


// ✅ Mount routers

// app.use("/uploads", uploadsRouter);

// For My chatting System
// app.use("/uploads", uploads);
// app.use("/reports", reports);

// app.post("/reports", (req,res)=>{
//     res.send("good");
// })


// const chatApiRoutes = require("./routes/chat_api");
// app.use(chatApiRoutes);
// End here
app.use(express.static("public"));
app.set('view engine', 'ejs');


// const passwrdResetToken = require('node-random-chars');
const uri = "mongodb://127.0.0.1:27017/watchTeam";
// const uri = "mongodb+srv://fadeelahfancy98com:"+process.env.DBPASSWORD+"@emc.5phugjz.mongodb.net/emcDB";
// const uri = "mongodb+srv://fadeelahfancy98com_db_user:5UHmLPQOe3PPgI9D@cluster0.wlgwqir.mongodb.net/watchTeam";


// Sessions start
app.set("trust proxy", 1); // if hosted behind proxy (Render/Heroku/Nginx)

app.use(session({
    secret: process.env.SESSION_SECRET || "watchTeam",
    resave: false,
    saveUninitialized: false,

    // ✅ connect-mongo v6
    store: new MongoStore({
        mongoUrl: uri,
        collectionName: "sessions",
        ttl: 60 * 60 * 24 * 7, // 7 days (seconds)
    }),

    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production", // must be true on HTTPS
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days (ms)
    }
}));
// Sessions End

// Initialize Seesion start
app.use(passport.initialize());
app.use(passport.session());




//sub 
app.use(attachSubscription);

app.use((req, res, next) => {
    res.locals.userInfo = req.user || null;
    res.locals.user = req.user || null;
    next();
});
// const { registerChatRoutes } = require("./routes/chat_api.js");

// Initialize Seesion end

database().catch(err => console.log(err));


async function database() {
    await mongoose.connect(uri);
    // await mongoose.connect('mongodb://127.0.0.1:27017/emcDB');
}


function appDb() {
    // userschema.plugin(uniqueValidator);
    const Admindb = mongoose.model("User", userschema);
    passport.use(Admindb.createStrategy());

    passport.serializeUser(function (user, cb) {
        console.log("serializing user uwuss:" + JSON.stringify(user))
        process.nextTick(function () {
            console.log(user.id);
            return cb(null, user.id)
        })
    });

    passport.deserializeUser((id, done) => {
        process.nextTick(async () => {
            try {
                const user = await User.findById(id); // optional: add .lean() if needed
                console.log("🎯 User fetched from DB in deserialize:", user);
                done(null, user);
            } catch (err) {
                done(err);
            }
        });
    });

    return Admindb;
}

const User = appDb();
const Company = mongoose.model("Company", companyInfo);
const { registerChatRoutes } = require("./routes/chat_api.js");
// registerUserRoutes(app);
registerChatRoutes(app,);

// The main server and socket logic are now handled in app.js
registerReportRoutes(app,);
registerUploadRoutes(app,);



//WEBSITE PAGES


// const idCountDB = mongoose.model("UserIdCount",idCountSchema);
// const paymentModel = mongoose.model("Payment", payment);

// ////////////////




app.get("/sign-in", (req, res) => {
    const webLoginError = req.session.webLoginError || null;
    delete req.session.webLoginError;
    res.render("auth/sign-in", { webLoginError });
})

app.get("/sign-up", (req, res) => {
    res.render("auth/sign-up");
})

// CLIENT COUNT
function clientCount(myComp) {
    return User.countDocuments({ assignedCompanyID: myComp, userType: "Client", status: true }).then((count) => {
        console.log("Active Clients:", count);
        return count;

    }).catch((err) => {
        console.log("Error counting clients", err);
        return 0;

    });


}

// BACK OFFICE USER COUNT
function bOfficeCount(myComp) {
    return User.countDocuments({ assignedCompanyID: myComp, userType: "Super Admin", status: true }).then((count) => {
        console.log("BackOffice User:", count);
        return count;

    }).catch((err) => {
        console.log("Error counting BOU", err);
        return 0;

    });


}

function guardsCount(myComp) {
    return User.countDocuments({ assignedCompanyID: myComp, userType: "AmobileGuard", status: true }).then((count) => {
        console.log("Guards Count:", count);
        return count;
    }).catch((err) => {
        console.log("error in counting");
        return 0;

    });
}

// ACTIVE POST SITE COUNT
function postSiteCount(mySite) {
    return Company.findById(mySite).then((result) => {
        var postCount = 0;
        result.postSite.forEach(function (site) {
            if (site.statusIsActive == true) {
                postCount++;
            }
        });
        console.log("my Postcount is", postCount);

        return postCount;
    }).catch((err) => {
        console.log(err);

        return 0;
    })


}

app.get("/dashboard", requireActiveSubscription,
    requireFeature("dashboard"), async (req, res) => {


        //FOR LIVE TRACKING 
        const guardId = req.session.lastGuardId || ""; // fallback if none

        let myCompInfo = {};
        if (req.isAuthenticated()) {
            if (isClientUser(req.user)) {
                return res.redirect("/activities");
            }
            const loginTime = req.session.lastLog;
            delete req.session.lastLog;
            console.log("Last login is", loginTime);


            let myCount;
            let bCount;
            let pCount;
            let gCount;
            // Updating User Login.
            try {
                await User.findByIdAndUpdate(req.user._id, {
                    lastLogin: loginTime
                });
            } catch (err) {
                console.log(err, "Could not save Date");

            }

            try {
                myCount = await clientCount(req.user.assignedCompanyID);
                bCount = await bOfficeCount(req.user.assignedCompanyID);
                pCount = await postSiteCount(req.user.assignedCompanyID);
                gCount = await guardsCount(req.user.assignedCompanyID);

                console.log("Retuened Post COunt:", pCount);
            } catch (error) {

            }



            if (req.user.assignedCompanyID == null) {
                // console.log("Its Empty");
                // console.log("MY IDDD",req.user.id);

                Company.findOne({ "backOfficeUser.bUserID": req.user.id }).then((bUser) => {
                    console.log("What found", bUser.id);
                    req.user.assignedCompanyID = bUser.id;
                    req.user.save();
                    myCompInfo = bUser;

                }).catch((err) => {
                    console.log("My Error", err);

                });
                const myCC = await Company.findOne({ "backOfficeUser.bUserID": req.user.id });
                // console.log("My COM INFO", myCC);

                res.render("dashboard/dashb", {
                    userInfo: req.user, activeClient: myCount, backOUser: bCount, compPostSite: pCount,
                    guardCount: gCount, companyInfo: myCC, guardId
                });
            } else {
                const myCC = await Company.findById(req.user.assignedCompanyID);
                // console.log("My COM INFO else esle", myCC);
                // console.log("My COM INFO", myC);
                res.render("dashboard/dashb", {
                    userInfo: req.user, activeClient: myCount, backOUser: bCount, compPostSite: pCount,
                    guardCount: gCount, companyInfo: myCC, guardId
                });
            }

        } else {
            res.redirect("/sign-in");
        }
    })

app.get("/activities", async (req, res) => {
    if (req.isAuthenticated()) {
        const myAC = await Company.findById(req.user.assignedCompanyID).lean();
        if (!myAC) {
            return res.redirect("/sign-in");
        }

        if (isClientUser(req.user)) {
            const { assignedPostSiteId } = await getClientScope(req.user);
            const checkedForSite = (myAC.checkedReport || []).filter((item) => String(item.postSite || "") === String(assignedPostSiteId || ""));
            const allowedIds = new Set(checkedForSite.map((item) => String(item._id)));
            myAC.activity = (myAC.activity || []).filter((item) => allowedIds.has(String(item.activityId || "")));
            myAC.checkedReport = checkedForSite;
            myAC.postSite = (myAC.postSite || []).filter((ps) => String(ps._id) === String(assignedPostSiteId || ""));
        }

        res.render("dashboard/activity", { userInfo: req.user, companyInfo: myAC });
    } else {
        res.redirect("/sign-in");
    }

})

app.get("/clients", requireActiveSubscription, requireFeature("clients"), async (req, res) => {
    const toast = req.session.toast;
    const upgradeMessage = req.session.upgradeMessage || null;
    delete req.session.upgradeMessage;

    if (req.isAuthenticated()) {
        delete req.session.toast;

        try {
            const companyId = req.user.assignedCompanyID;

            const clientList = await User.find({
                userType: "Client",
                assignedCompanyID: companyId
            });

            let maxClients = -1;
            let clientsLeft = -1;
            let clientLimitReached = false;

            // Platform Admin = no limit
            if (req.user.userType === "Super Admin") {
                const features = await getResolvedFeatures(companyId);
                maxClients = getLimitValue(features, "maxClients");

                if (!isUnlimited(maxClients)) {
                    clientsLeft = Math.max(0, maxClients - clientList.length);
                    clientLimitReached = clientsLeft === 0;
                }
            }

            return res.render("dashboard/clients", {
                clientList,
                success: toast ? true : false,
                myCompany: companyId,
                userInfo: req.user,
                maxClients,
                clientsLeft,
                clientLimitReached,
                upgradeMessage
            });
        } catch (err) {
            return res.send(err);
        }
    } else {
        return res.redirect("/sign-in");
    }
});

app.get("/new-cli", async (req, res) => {
    if (req.isAuthenticated()) {
        if (isClientUser(req.user)) {
            return res.redirect("/activities");
        }
        try {
            const companyId = req.user.assignedCompanyID;

            // Platform Admin = no limit
            if (req.user.userType === "Super Admin") {
                const features = await getResolvedFeatures(companyId);
                const maxClients = getLimitValue(features, "maxClients");

                if (!isUnlimited(maxClients)) {
                    const currentClients = await User.countDocuments({
                        userType: "Client",
                        assignedCompanyID: companyId
                    });

                    if (currentClients >= maxClients) {
                        req.session.upgradeMessage = "You have reached your client limit. Upgrade your plan.";
                        return res.redirect("/clients");
                    }
                }
            }

            return res.render("dashboard/new-client", { userInfo: req.user });
        } catch (err) {
            return res.send(err);
        }
    } else {
        return res.redirect("/sign-in");
    }
});

app.get("/post-site", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/sign-in");
  }

  try {
    if (isClientUser(req.user)) {
      return res.redirect("/activities");
    }
    const toastPost = req.session.post;
    delete req.session.post;

    const upgradeMessage = req.session.upgradeMessage || null;
    delete req.session.upgradeMessage;

    const companyId = req.user.assignedCompanyID;
    const company = await Company.findById(companyId);

    if (!company) {
      return res.send("Company not found");
    }

    let maxPostSites = -1;
    let postSitesLeft = -1;
    let postSiteLimitReached = false;

    // Platform Admin = no limit
    if (req.user.userType === "Super Admin") {
      const features = await getResolvedFeatures(companyId);
      maxPostSites = getLimitValue(features, "maxPostSites");

      if (!isUnlimited(maxPostSites)) {
        const currentPostSites = Array.isArray(company.postSite)
          ? company.postSite.length
          : 0;

        postSitesLeft = Math.max(0, maxPostSites - currentPostSites);
        postSiteLimitReached = postSitesLeft === 0;
      }
    }

    return res.render("dashboard/post-site", {
      userInfo: req.user,
      postSiteList: company.postSite,
      success: toastPost ? true : false,
      maxPostSites,
      postSitesLeft,
      postSiteLimitReached,
      upgradeMessage
    });
  } catch (err) {
    console.log(err);
    return res.send(err);
  }
});

app.get("/new-post-site", async (req, res) => {
    if (req.isAuthenticated()) {
        if (isClientUser(req.user)) {
            return res.redirect("/activities");
        }
        const companyId = req.user.assignedCompanyID;
        const company = await Company.findById(companyId);

        if (req.user.userType === "Super Admin") {
            const features = await getResolvedFeatures(companyId);
            const maxPostSites = getLimitValue(features, "maxPostSites");

            if (!isUnlimited(maxPostSites)) {
                const currentPostSites = Array.isArray(company.postSite) ? company.postSite.length : 0;

                if (currentPostSites >= maxPostSites) {
                    req.session.upgradeMessage = "You have reached your post site limit. Upgrade your plan.";
                    return res.redirect("/post-site");
                }
            }
        }

        User.find({
            assignedCompanyID: req.user.assignedCompanyID,
            userType: "Client"
        }).then((clientFound) => {
            res.render("dashboard/new-post-site", { userInfo: req.user, clientToSite: clientFound });
        }).catch((err) => {
            res.send(err);
        })
    } else {
        res.redirect("/sign-in");
    }

})

app.get("/guards", requireActiveSubscription, requireFeature("securityTeam"), async (req, res) => {
    console.log("I AM in Gaurds");

    if (!req.isAuthenticated()) {
        return res.redirect("/sign-in");
    }

    try {
        const toast = req.session.guardtoast;
        delete req.session.guardtoast;

        const upgradeMessage = req.session.upgradeMessage || null;
        delete req.session.upgradeMessage;

        const companyId = req.user.assignedCompanyID;

        let guardQuery = {
            assignedCompanyID: companyId,
            userType: "AmobileGuard"
        };

        if (isClientUser(req.user)) {
            const { assignedPostSiteId } = await getClientScope(req.user);
            guardQuery.guardPostSite = { $elemMatch: { postSiteID: assignedPostSiteId } };
        }

        const guardList = await User.find(guardQuery);

        let maxSecurityGuards = -1;
        let guardsLeft = -1;
        let guardLimitReached = false;

        // Platform Admin = no limit
        if (req.user.userType === "Super Admin") {
            const features = await getResolvedFeatures(companyId);
            maxSecurityGuards = getLimitValue(features, "maxSecurityGuards");

            if (!isUnlimited(maxSecurityGuards)) {
                guardsLeft = Math.max(0, maxSecurityGuards - guardList.length);
                guardLimitReached = guardsLeft === 0;
            }
        }

        return res.render("dashboard/guards", {
            userInfo: req.user,
            guardList: guardList,
            success: toast ? true : false,
            maxSecurityGuards,
            guardsLeft,
            guardLimitReached,
            upgradeMessage
        });
    } catch (err) {
        console.log(err);
        return res.send(err);
    }
});



app.get("/bo-user", (req, res) => {
    const toast = req.session.admin_toast;
    const dateNow = new Date();
    // const lastLogin = new Date(Date.now());

    if (req.isAuthenticated()) {
        if (isClientUser(req.user)) {
            return res.redirect("/activities");
        }

        // Clear it so it only shows once


        delete req.session.admin_toast;
        const lastLog = new Date(req.user.lastLogin);

        console.log(timeAgo(lastLog));
        User.find().then((users) => {
            // console.log("this is my TOASE  ", toast);
            res.render("dashboard/back-office-user", { userInfo: req.user, allUsers: users, success: toast ? true : false, });
        })
    } else {
        res.redirect("/sign-in");
    }
})

app.get("/new-bo-user", (req, res) => {
    if (req.isAuthenticated()) {
        if (isClientUser(req.user)) {
            return res.redirect("/activities");
        }
        const randomString = Math.random().toString(36).substring(2, 10);
        // console.log("Random String pass", randomString);
        User.find({ assignedCompanyID: req.user.assignedCompanyID, userType: "Client" }).then((users) => {
            res.render("dashboard/new-bo-user", { userInfo: req.user, clientUsers: users, password: randomString });
        }).catch((err) => {
            res.send(err);
        })
    } else {
        res.redirect("/sign-in");
    }
})

app.get("/report", (req, res) => {
    if (req.isAuthenticated()) {
        res.render("dashboard/report", { userInfo: req.user });
    } else {
        res.redirect("/sign-in")
    }
})

app.get("/analytics/shedule", (req, res) => {
    if (req.isAuthenticated()) {
        res.render("dashboard/shedule", { userInfo: req.user });
    } else {
        res.redirect("/sign-in")
    }
})

app.get("/chat", requireActiveSubscription, async (req, res) => {
    if (req.isAuthenticated()) {
        let companyUsers;
        if (isClientUser(req.user)) {
            const { assignedPostSiteId } = await getClientScope(req.user);
            companyUsers = await User.find({
                assignedCompanyID: req.user.assignedCompanyID,
                _id: { $ne: req.user._id },
                $or: [
                    { userType: "Super Admin" },
                    { userType: "AmobileGuard", guardPostSite: { $elemMatch: { postSiteID: assignedPostSiteId } } }
                ]
            }).select('fullname username _id userType');
        } else {
            companyUsers = await User.find({
                assignedCompanyID: req.user.assignedCompanyID,
                _id: { $ne: req.user._id }
            }).select('fullname username _id userType');
        }

        res.render("dashboard/chat", { userInfo: req.user, companyUsers: companyUsers });
    } else {
        res.redirect("/sign-in")
    }
})

// app.get("/api/messages/:partnerId", async (req, res) => {
//     if(req.isAuthenticated()){
//         const messages = await Message.find({
//             $or: [
//                 { sender: req.user._id, receiver: req.params.partnerId },
//                 { sender: req.params.partnerId, receiver: req.user._id }
//             ]
//         }).sort({ timestamp: 1 });
//         res.json(messages);
//     } else {
//         res.status(401).json([]);
//     }
// });

// app.get("/time-log", (req,res)=>{
//    if(req.isAuthenticated()){
//          res.render("dashboard/time-log", {userInfo:req.user});
//     }else{
//         res.redirect("/sign-in")
//     }
// })

app.get("/breaks", (req, res) => {
    if (req.isAuthenticated()) {
        res.render("dashboard/breaks", { userInfo: req.user });
    } else {
        res.redirect("/sign-in")
    }
})

app.get("/reports", (req, res) => {
    if (req.isAuthenticated()) {
        res.render("dashboard/reports", { userInfo: req.user });
    } else {
        res.redirect("/sign-in")
    }
})


// app.get("/attendance", requireActiveSubscription,
//     requireFeature("timeClock"), (req, res) => {
//         if (req.isAuthenticated()) {
//             res.render("dashboard/attendance", { userInfo: req.user });
//         } else {
//             res.redirect("/sign-in")
//         }
//     })

app.get("/open-shift", (req, res) => {
    if (req.isAuthenticated()) {
        res.render("dashboard/open-shift", { userInfo: req.user });
    } else {
        res.redirect("/sign-in")
    }
})

app.get("/shift-ex", (req, res) => {
    if (req.isAuthenticated()) {
        res.render("dashboard/shift-ex", { userInfo: req.user });
    } else {
        res.redirect("/sign-in")
    }
})


// app.get("/time-off", (req, res) => {
//     if (req.isAuthenticated()) {
//         res.render("dashboard/time-off", { userInfo: req.user });
//     } else {
//         res.redirect("/sign-in")
//     }
// })

// app.get("/time-off", (req,res)=>{
//     res.render("dashboard/time-off");
// })

app.get("/gen-payroll", async (req, res) => {
    if (!req.isAuthenticated()) {
        res.redirect("/sign-in");
    }
    if (isClientUser(req.user)) {
        return res.redirect("/activities");
    }

    const guards = await User.find({
        assignedCompanyID: req.user.assignedCompanyID,
        userType: "AmobileGuard"
    });

    res.render("dashboard/run-payroll", { userInfo: req.user, guards, result: [] });
})

app.get("/past-payroll", async (req, res) => {
    if (!req.isAuthenticated()) {
        res.redirect("/sign-in");
    }
    if (isClientUser(req.user)) {
        return res.redirect("/activities");
    }

    const guards = await User.find({
        assignedCompanyID: req.user.assignedCompanyID,
        userType: "AmobileGuard"
    });

    console.log(guards);


    res.render("dashboard/past-payroll", { userInfo: req.user });
})

app.get("/guard-details", (req, res) => {
    if (req.isAuthenticated()) {
        if (isClientUser(req.user)) {
            return res.redirect("/activities");
        }
        res.render("dashboard/guard-details", { userInfo: req.user });
    } else {
        res.redirect("/sign-in");
    }
})




app.get("/test", (req, res) => {
    res.render("dashboard/test");
})

// ONPAGE LOADER:
// app.get('/form', async (req, res) => {
//   const categories = await Company.find(); // e.g., from MongoDB
//   res.render('form', { Company });
// });
// app.post("/api/chats/direct", async (req, res) => {
//   try {
//     const userId = req.user?._id;
//     const otherUserId = req.body.otherUserId;

//     if (!userId) return res.status(401).json({ ok: false, error: "Not logged in" });
//     if (!mongoose.isValidObjectId(otherUserId)) return res.status(400).json({ ok: false, error: "Invalid otherUserId" });

//     // IMPORTANT: assignedCompanyID is String on your User schema
//     const companyId = String(req.user.assignedCompanyID || "");
//     if (!companyId) return res.status(400).json({ ok: false, error: "User has no assignedCompanyID" });

//     const directKey = buildDirectKey(companyId, userId, otherUserId);

//     let chat = await Chat.findOne({ companyId, directKey });
//     if (!chat) {
//       chat = await Chat.create({
//         companyId,
//         type: "direct",
//         participants: [userId, otherUserId],
//         directKey,
//       });
//     }

//     return res.json({ ok: true, chatId: String(chat._id) });
//   } catch (e) {
//     console.error(e);
//     return res.status(500).json({ ok: false, error: "Server error" });
//   }
// });

// // Get messages
// app.get("/api/messages", async (req, res) => {
//   try {
//     const userId = req.user?._id;
//     const { chatId, limit = 30 } = req.query;

//     if (!userId) return res.status(401).json({ ok: false, error: "Not logged in" });
//     if (!mongoose.isValidObjectId(chatId)) return res.status(400).json({ ok: false, error: "Invalid chatId" });

//     const companyId = String(req.user.assignedCompanyID || "");
//     const msgs = await Message.find({ companyId, chatId })
//       .sort({ createdAt: -1 })
//       .limit(Math.min(Number(limit) || 30, 200));

//     return res.json(msgs);
//   } catch (e) {
//     console.error(e);
//     return res.status(500).json({ ok: false, error: "Server error" });
//   }
// });








module.exports = {
    main: app,
    userDB: User,
    // messageDB: Message,
    // clientDB:Client,

}