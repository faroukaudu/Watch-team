const myModule = require('./index.js');
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const passport = require("passport");
const session = require("express-session");
const _ = require('lodash');
var companyInfo = require(__dirname + "/db/companyinfodb.js");
const adminCreatePassword = require('./msg_send.js');
const addingGuardstoPostSite = require("./add_gaurd.js");
const { emailSent } = require("./nodemailer");




const app = myModule.main;
const User = myModule.userDB;
const Company = mongoose.model("Company", companyInfo);

const { getResolvedFeatures, getLimitValue, isUnlimited } = require("./src/utils/subscriptionLimits");
const { redirectToPricingWithUpgradeMessage } = require("./src/utils/upgradeRedirect");

// function addingGuardstoPostSite(guardInfo, companyID){
//   const guardDetails = {
//     name:guardInfo.fullname,
//     email:guardInfo.username,
//     mobile:guardInfo.phone,
//     statusIsActive:true,
//     assignClient:guardInfo.guardClients,
//     assignPost:guardInfo.guardPostSite,
//   };
//   Company.findOne({_id:companyID}).then((mainCompany)=>{
//     console.log("____________________________--|--___.", guardDetails);

//     mainCompany.guards.push(guardDetails); // Adding Guard ID to know Assigned Guard in that Company.
//     // mainCompany.postSite
//     // return "Added guard Success";
//     mainCompany.save();

//   }).catch((err)=>{
//     // res.send(err);
//     console.log(err);

//   })

// }




// module.exports = router;

// Former Sign up
// app.post("/sign-up", (req, res) => {
//   console.log("signing up");

//   console.log(req.body.company_name, req.body.full_name, req.body.password, req.body.cpassword);
//   req.body.username = _.capitalize(req.body.username);
//   // console.log(req.body.email);
//   User.register(new User({
//     username: req.body.username,
//     fullname: _.capitalize(req.body.full_name),
//     compName: _.capitalize(req.body.company_name),
//     email: _.capitalize(req.body.username),
//     userType: "Super Admin",
//     status: true,


//   }), req.body.password,
//     async function (err, user) {
//       if (!err) {
//         // Creating a Company
//         try {
//           const createNewCompany = {
//             companyName: user.compName,
//             backOfficeUser: {
//               bUserID: user._id,
//               bUsername: user.fullname,
//               bEmail: user.email
//             },
//             companyJoinCode: "ABC123"
//           };

//           const comp = await Company.create(createNewCompany);
//           user.assignedCompanyID = String(comp._id);
//           await user.save();
//           console.log(comp.companyName, "Company Created");



//           passport.authenticate("local", {
//             failureRedirect: '/error991',
//             failureMessage: true
//           })(req, res, function () {

//             // setTimeout(function() {
//             res.redirect("/sign-in");
//             // res.send("User Registred");
//             // welcomeEmail({username:req.body.firstname, email:req.body.username});
//             // }, 2000);
//           });
//         } catch (err) {
//           console.log("Company not Created", err);
//           res.status(500).send("Company creation failed");
//         }
//         // Try Catch Error for creating Company
//       } else {
//         res.send(err)
//         // res.render("userdash/animations/usererr", {errorMsg:"Registration Error!!!"});
//       }

//     })

// })

app.post("/sign-up/send-code", async (req, res) => {
  try {
    console.log("Sending sign-up verification code");

    const email = _.capitalize(
  String(req.body.username || "").trim()
);

    if (!email) {
      return res.json({
        success: false,
        message: "Email address is required."
      });
    }

    if (req.body.password !== req.body.cpassword) {
      return res.json({
        success: false,
        message: "Passwords do not match."
      });
    }

    const existingUser = await User.findOne({ username: email });

    if (existingUser) {
      return res.json({
        success: false,
        message: "This email is already registered."
      });
    }

    const code = Math.floor(1000 + Math.random() * 9000).toString();

    req.session.pendingSuperAdminRegistration = {
      company_name: req.body.company_name,
      full_name: req.body.full_name,
      username: email,
      password: req.body.password
    };

    req.session.superAdminSignupCode = code;
    req.session.superAdminSignupCodeExpires = Date.now() + 10 * 60 * 1000;

    const html = `
      <div style="font-family:Arial,sans-serif;background:#f4f7fb;padding:24px;">
        <div style="max-width:600px;margin:auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;">
          <div style="background:#0F3DFF;color:#ffffff;padding:22px;">
            <h2 style="margin:0;">Watch Team Email Verification</h2>
          </div>

          <div style="padding:24px;color:#222;">
            <p>Hello ${req.body.full_name || "there"},</p>
            <p>Use the verification code below to complete your Watch Team registration.</p>

            <div style="text-align:center;margin:28px 0;">
              <div style="font-size:34px;font-weight:bold;letter-spacing:8px;color:#0F3DFF;">
                ${code}
              </div>
            </div>

            <p style="color:#6b7280;font-size:14px;">This code will expire in 10 minutes.</p>
          </div>
        </div>
      </div>
    `;

    await emailSent({
      sendTo: email,
      title: "Watch Team Verification Code",
      message: `Your Watch Team verification code is ${code}`,
      template: html,
      emailType: "super_admin_signup_verification"
    });

    return res.render("auth/signup-verify", {
  email,
  message: "Verification code sent to your email."
});

  } catch (err) {
    console.log("Send signup code error:", err);
    return res.json({
      success: false,
      message: "Unable to send verification code."
    });
  }
});

// SUPER ADMIN SIGN UP
app.post("/sign-up", async (req, res) => {
  try {
    console.log("Verifying sign-up code and creating account");

    const { code } = req.body;

    const pending = req.session.pendingSuperAdminRegistration;

    if (!pending) {
      return res.status(400).send("Registration session expired. Please start again.");
    }

    if (
      !code ||
      String(code).trim() !== String(req.session.superAdminSignupCode) ||
      Date.now() > req.session.superAdminSignupCodeExpires
    ) {
     return res.render("auth/signup-verify", {
  email: pending.username,
  error: "Invalid or expired verification code."
});
    }

    const existingUser = await User.findOne({ username: pending.username });

    if (existingUser) {
      return res.status(400).send("This email is already registered.");
    }

    const newUser = new User({
      username: pending.username,
      fullname: _.capitalize(pending.full_name),
      compName: _.capitalize(pending.company_name),
      email: pending.username,
      userType: "Super Admin",
      status: true,
      emailVerified: true
    });

    User.register(newUser, pending.password, async function (err, user) {
      if (err) {
        console.log("Registration error:", err);
        return res.send(err);
      }

      try {
        const createNewCompany = {
          companyName: user.compName,
          backOfficeUser: {
            bUserID: user._id,
            bUsername: user.fullname,
            bEmail: user.email
          },
          companyJoinCode: "ABC123"
        };

        const comp = await Company.create(createNewCompany);

        user.assignedCompanyID = String(comp._id);
        await user.save();

        const loginUrl = `${process.env.PUBLIC_BASE_URL || "http://localhost:9000"}/sign-in`;

        const welcomeHtml = `
          <div style="font-family:Arial,sans-serif;background:#f4f7fb;padding:24px;">
            <div style="max-width:650px;margin:auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;">
              <div style="background:#0F3DFF;color:#ffffff;padding:24px;">
                <h2 style="margin:0;">Welcome to Watch Team</h2>
              </div>

              <div style="padding:26px;color:#222;">
                <p>Hello ${user.fullname || "there"},</p>

                <p>
                  Thank you for joining Watch Team. We are excited to help your company improve security operations,
                  manage guards, track reports, and strengthen site protection.
                </p>

                <p>
                  To start enjoying Watch Team services, please log in and subscribe to a plan.
                </p>

                <div style="text-align:center;margin:28px 0;">
                  <a href="${loginUrl}"
                     style="background:#0F3DFF;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:8px;font-weight:bold;display:inline-block;">
                    Login and Subscribe
                  </a>
                </div>

                <p style="font-size:13px;color:#6b7280;">
                  If the button does not work, copy and paste this link into your browser:<br>
                  ${loginUrl}
                </p>
              </div>
            </div>
          </div>
        `;

        await emailSent({
          sendTo: user.email,
          title: "Welcome to Watch Team",
          message: "Thank you for joining Watch Team. Please login and subscribe to a plan.",
          template: welcomeHtml,
          emailType: "super_admin_welcome"
        });

        delete req.session.pendingSuperAdminRegistration;
        delete req.session.superAdminSignupCode;
        delete req.session.superAdminSignupCodeExpires;

        return res.redirect("/sign-in");

      } catch (err) {
        console.log("Company creation failed:", err);
        return res.status(500).send("Company creation failed");
      }
    });

  } catch (err) {
    console.log("Verify signup error:", err);
    return res.status(500).send("Registration failed.");
  }
});


// Client Registration
app.post("/new-client", async (req, res) => {

  if (req.isAuthenticated()) {
    const companyId = req.user.assignedCompanyID;

    // Platform Admin = no limit
    if (req.user.userType === "Super Admin") {
      const features = await getResolvedFeatures(companyId);
      const maxClients = getLimitValue(features, "maxClients");

      if (!isUnlimited(maxClients)) {
        const currentClients = await User.countDocuments({
          assignedCompanyID: companyId,
          userType: "Client",
        });

        if (currentClients >= maxClients) {
          return redirectToPricingWithUpgradeMessage(
            req,
            res,
            "You have reached your client limit. Upgrade your plan."
          );
        }
      }
    }




    await Company.findOne()
    const features = await getResolvedFeatures(req.session.companyID || req.user?.assignedCompanyID);
    const maxClients = getLimitValue(features, "maxClients");

    if (!isUnlimited(maxClients)) {
      const currentClients = await User.countDocuments({
        assignedCompanyID: req.session.companyID || req.user?.assignedCompanyID,
        userType: "Client",
      });

      if (currentClients >= maxClients) {
        return redirectToPricingWithUpgradeMessage(
          req,
          res,
          "Your current subscription allows only " +
          maxClients +
          " client account(s). Please upgrade your subscription to add more."
        );
      }
    }


    const { username, client_name, password, cpassword, phone } = req.body;

    const newClient = new User({
      username: _.capitalize(username),
      fullname: _.capitalize(client_name),
      email: _.capitalize(username), // emails should be lowercase
      // assignedCompanyID: "Mine",
      userType: "Client",
      phone,
      assignedCompanyID: req.user.assignedCompanyID,
      compName: req.user.compName,
      status: true,


    });

    try {
      await User.register(newClient, password);
      await Company.a // 👈 No auto-login
      req.session.toast = {
        status: true,
        message: 'User created successfully!'
      };
      res.redirect("clients");
      // res.render("dashboard/clients", {success:true, userInfo:req.user});
      // ✅ stays in admin session
    } catch (err) {
      console.error("Registration error:", err);
      res.status(400).send("Error registering client: " + err.message);
      // Or: res.render("error-page", { message: "Client registration failed" });
    }


  } else {

  }

});

// BackOffice User Registration
app.post("/add-bo-user", async (req, res) => {

  if (req.isAuthenticated()) {
    await Company.findOne()
    const features = await getResolvedFeatures(req.session.companyID || req.user?.assignedCompanyID);
    const maxSuperAdmins = getLimitValue(features, "maxSuperAdmins");

    if (!isUnlimited(maxSuperAdmins)) {
      const currentSuperAdmins = await User.countDocuments({
        assignedCompanyID: req.session.companyID || req.user?.assignedCompanyID,
        userType: "Super Admin",
      });

      if (currentSuperAdmins >= maxSuperAdmins) {
        return redirectToPricingWithUpgradeMessage(
          req,
          res,
          "Your current subscription allows only " +
          maxSuperAdmins +
          " Super Admin account(s). Please upgrade your subscription to add more."
        );
      }
    }


    const { username, super_name, password, cpassword, phone } = req.body;

    const newClient = new User({
      username: _.capitalize(username),
      fullname: _.capitalize(super_name),
      email: _.capitalize(username), // emails should be lowercase
      // assignedCompanyID: "Mine",
      userType: "Super Admin",
      phone,
      assignedCompanyID: req.user.assignedCompanyID,
      compName: req.user.compName,
      status: false,


    });

    try {
      const newAdmin = await User.register(newClient, password);
      const userID = newAdmin._id;
      await Company.a // 👈 No auto-login
      await adminCreatePassword.aCreatePass({ email: username, userID, fullname: super_name, });
      req.session.admin_toast = {
        status: true,
        message: 'Backoffice User created successfully!'
      };

      res.redirect("/bo-user");
      // res.render("dashboard/clients", {success:true, userInfo:req.user});
      // ✅ stays in admin session
    } catch (err) {
      console.error("Registration error:", err);
      res.status(400).send("Error registering client: " + err.message);
      // Or: res.render("error-page", { message: "Client registration failed" });
    }


  } else {

  }

});

// Backoffice Create Password
app.get("/create-password/:id/:fullname", (req, res) => {
  console.log(req.params.id + "This is name" + req.params.fullname);

  const { id, fullname } = req.params;
  res.render("auth/admin-create-pass", { userID: id, name: fullname });

});

app.post("/admin-create-password", (req, res) => {
  console.log(req.body.userid);
  console.log(req.body.password);
  const id = req.body.userid;

  User.findById(id).then(async (userFound) => {
    await userFound.setPassword(req.body.password);
    userFound.status = true;
    await userFound.save();
    // req.flash('success', 'Password has been reset! You can now log in.');
    res.redirect('/sign-in');

  }).catch((err) => {
    res.send("Error setting password", err)
  });

});

// Guards Registration
app.post("/new-guard", async (req, res) => {

  if (req.isAuthenticated()) {
    await Company.findOne()
    const companyId = req.user.assignedCompanyID;

    if (req.user.userType === "Super Admin") {
      const features = await getResolvedFeatures(companyId);
      const maxSecurityGuards = getLimitValue(features, "maxSecurityGuards");

      if (!isUnlimited(maxSecurityGuards)) {
        const currentGuards = await User.countDocuments({
          assignedCompanyID: companyId,
          userType: "AmobileGuard",
        });

        if (currentGuards >= maxSecurityGuards) {
          req.session.upgradeMessage = "You have reached your guard limit. Upgrade your plan.";
          return res.redirect("/guards");
        }
      }
    }


    const { username, client_name, password, cpassword, phone } = req.body;

    const newClient = new User({
      username: _.capitalize(username),
      fullname: _.capitalize(client_name),
      email: _.capitalize(username), // emails should be lowercase
      // assignedCompanyID: "Mine",
      userType: "Guards",
      phone,
      assignedCompanyID: req.user.assignedCompanyID,
      compName: req.user.compName,
      status: true,


    });

    try {
      await User.register(newClient, password);
      await Company.a // 👈 No auto-login
      req.session.toast = {
        status: true,
        message: 'User created successfully!'
      };
      res.redirect("clients");
      // res.render("dashboard/clients", {success:true, userInfo:req.user});
      // ✅ stays in admin session
    } catch (err) {
      console.error("Registration error:", err);
      res.status(400).send("Error registering client: " + err.message);
      // Or: res.render("error-page", { message: "Client registration failed" });
    }


  } else {

  }

});







// ADMIN Login
app.post("/sign-in", (req, res) => {

  req.body.username = _.capitalize(req.body.username);
  var userLogin = new User({ username: req.body.username, password: req.body.password });
  req.login(userLogin, function (err) {
passport.authenticate("local", (err, user, info) => {

  if (err) {
    return next(err);
  }

  if (!user) {

    req.session.resetModal = {
      title: "Login Failed",
      message: "Incorrect email address or password."
    };

    return res.redirect("/sign-in");
  }

  req.logIn(user, function (err) {

    if (err) {
      return next(err);
    }

    req.session.lastLog = new Date();

    return res.redirect("/dashboard");
  });

})(req, res);
  })
});

// CREATING GUARD PROFILE Registering

app.post("/add-guard", async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      const companyId = req.session.companyID || req.user?.assignedCompanyID;

      // Restriction
      const features = await getResolvedFeatures(companyId);
      const maxSecurityGuards = getLimitValue(features, "maxSecurityGuards");

      if (!isUnlimited(maxSecurityGuards)) {
        const currentGuards = await User.countDocuments({
          assignedCompanyID: companyId,
          userType: "AmobileGuard",
        });

        if (currentGuards >= maxSecurityGuards) {
          return redirectToPricingWithUpgradeMessage(
            req,
            res,
            "Your current subscription allows only " +
            maxSecurityGuards +
            " security guard account(s). Please upgrade your subscription to add more."
          );
        }
      }

      const {
        fname,
        lname,
        username,
        my_client,
        my_post,
        password,
        cpassword,
        phone,
        siteId
      } = req.body;

      if (password !== cpassword) {
        req.session.guardtoast = {
          status: false,
          message: "Password and confirm password do not match."
        };
        return res.redirect("/guards");


      }

      const company = await Company.findById(companyId);

      const selectedPostSite = company?.postSite?.find(
        (site) => String(site._id) === String(siteId)
      );

      const selectedPostSiteName = selectedPostSite?.siteName || "Unknown Post Site";

      const newGuard = new User({
        username: _.capitalize(username),
        fullname: _.capitalize(fname) + " " + _.capitalize(lname),
        email: String(username).toLowerCase(),
        userType: "AmobileGuard",
        phone: phone,
        assignedCompanyID: companyId,
        compName: req.user.compName,
        guardClients: [{ name: "EFCC", id: "My id" }],
        guardPostSite: [
          {
            siteName: selectedPostSiteName,
            postSiteID: siteId,
          }
        ],
        status: true,
      });

      const createdGuard = await User.register(newGuard, password);

      await addingGuardstoPostSite(createdGuard, companyId);

      req.session.guardtoast = {
        status: true,
        message: "Guard created successfully!"
      };

      return res.redirect("/guards");
    } catch (err) {
      console.error("Registration error:", err);

      req.session.guardtoast = {
        status: false,
        message: "Error registering Guard: " + err.message
      };

      return res.redirect("/guards");
    }
  } else {
    return res.send("Only authenticated users can add guards.");
  }
});



//   LogOut???>?>?>?>
app.get("/logout", (req, res) => {
  req.logout(function (err) {
    if (err) {
      console.log(err);
    } else {
      res.redirect("/sign-in");
    }
  })
});




// module.exports = {
//   siteReg:addingGuardstoPostSite

//   }

module.exports = addingGuardstoPostSite;

