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
const fs = require("fs");
const path = require("path");
const handlebars = require("handlebars");




const app = myModule.main;
const User = myModule.userDB;
const Company = mongoose.model("Company", companyInfo);

const { getResolvedFeatures, getLimitValue, isUnlimited } = require("./src/utils/subscriptionLimits");
const { isPlatformAdmin } = require("./src/utils/subscriptionLimits");
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
  if (!req.isAuthenticated()) {
    return res.redirect("/sign-in");
  }

  try {
    const companyId = req.session.companyID || req.user?.assignedCompanyID;

    // Platform Admin is unlimited. Other account types use the company plan.
    const features = await getResolvedFeatures(companyId);
    const maxClients = getLimitValue(features, "maxClients");

    if (!isPlatformAdmin(req.user) && !isUnlimited(maxClients)) {
      const currentClients = await User.countDocuments({
        assignedCompanyID: companyId,
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

    const {
      username,
      client_name,
      phone,
      address,
      password,
      cpassword,
    } = req.body;

    const email = String(username || "").trim().toLowerCase();
    const fullName = String(client_name || "").trim();
    const clientAddress = String(address || "").trim();
    const temporaryPassword = String(password || "");
    const confirmPassword = String(cpassword || "");

    if (!fullName || !email || !phone || !clientAddress || !temporaryPassword) {
      req.session.toast = {
        status: false,
        message: "Please complete all required client fields.",
      };
      return res.redirect("/new-cli");
    }

    if (temporaryPassword.length < 8) {
      req.session.toast = {
        status: false,
        message: "The temporary password must contain at least 8 characters.",
      };
      return res.redirect("/new-cli");
    }

    if (temporaryPassword !== confirmPassword) {
      req.session.toast = {
        status: false,
        message: "Password and confirm password do not match.",
      };
      return res.redirect("/new-cli");
    }

    const existingUser = await User.findOne({
      $or: [{ username: email }, { email }],
    }).lean();

    if (existingUser) {
      req.session.toast = {
        status: false,
        message: "A user with this email address already exists.",
      };
      return res.redirect("/new-cli");
    }

    const newClient = new User({
      username: email,
      fullname: fullName,
      email,
      address: clientAddress,
      userType: "Client",
      phone: String(phone).trim(),
      assignedCompanyID: companyId,
      compName: req.user.compName,
      status: true,
    });

    const createdClient = await User.register(newClient, temporaryPassword);

    const baseUrl = (
      process.env.PUBLIC_BASE_URL ||
      process.env.APP_BASE_URL ||
      `${req.protocol}://${req.get("host")}`
    ).replace(/\/$/, "");
    const signInUrl = `${baseUrl}/sign-in`;
    const companyName = req.user.compName || "Watch Team";

    const welcomeHtml = `
      <div style="margin:0;padding:32px 16px;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#172033;">
        <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e7ebf1;box-shadow:0 8px 30px rgba(20,33,61,.08);">
          <div style="padding:28px 32px;background:#111827;color:#ffffff;">
            <h1 style="margin:0;font-size:24px;line-height:1.3;">Welcome to Watch Team</h1>
          </div>
          <div style="padding:32px;">
            <p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Hello ${fullName},</p>
            <p style="margin:0 0 18px;font-size:16px;line-height:1.65;">
              You have been added as a Client for <strong>${companyName}</strong> on Watch Team.
            </p>
            <div style="margin:24px 0;padding:20px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;">
              <p style="margin:0 0 10px;font-size:14px;color:#667085;">Sign-in email</p>
              <p style="margin:0 0 18px;font-size:16px;font-weight:700;word-break:break-word;">${email}</p>
              <p style="margin:0 0 10px;font-size:14px;color:#667085;">Temporary password</p>
              <p style="margin:0;font-size:16px;font-weight:700;word-break:break-word;">${temporaryPassword}</p>
            </div>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.65;">
              For your security, please sign in and change this temporary password from the <strong>Profile</strong> section immediately.
            </p>
            <p style="margin:0 0 28px;">
              <a href="${signInUrl}" style="display:inline-block;padding:13px 22px;background:#e11d74;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;">Sign in to Watch Team</a>
            </p>
            <p style="margin:0;font-size:13px;line-height:1.6;color:#667085;word-break:break-all;">
              If the button does not work, open: ${signInUrl}
            </p>
          </div>
        </div>
      </div>
    `;

    let emailDelivered = true;
    try {
      await emailSent({
        sendTo: email,
        title: `Welcome to Watch Team - ${companyName}`,
        message:
          `Hello ${fullName}, you have been added as a Client for ${companyName}. ` +
          `Sign in at ${signInUrl} using ${email} and temporary password: ${temporaryPassword}. ` +
          `Please change your password from the Profile section immediately after signing in.`,
        template: welcomeHtml,
        emailType: "client_welcome",
      });
    } catch (emailError) {
      emailDelivered = false;
      console.error(
        `Client ${createdClient._id} was created, but the welcome email failed:`,
        emailError
      );
    }

    req.session.toast = {
      status: emailDelivered,
      message: emailDelivered
        ? "Client created successfully and the welcome email was sent."
        : "Client created successfully, but the welcome email could not be sent. Please provide the sign-in details manually.",
    };

    return res.redirect("/clients");
  } catch (err) {
    console.error("Client registration error:", err);

    req.session.toast = {
      status: false,
      message:
        err?.name === "UserExistsError"
          ? "A user with this email address already exists."
          : "The client could not be created. Please review the details and try again.",
    };

    return res.redirect("/new-cli");
  }
});


// BackOffice User Registration
app.post("/add-bo-user", async (req, res) => {

  if (req.isAuthenticated()) {
    const companyId =
      req.session.companyID || req.user?.assignedCompanyID;

    /*
     * Platform Admin is unlimited.
     * Back Office Users are currently stored as userType "Super Admin".
     * The primary company Super Admin is excluded from the additional
     * Back Office User count.
     */
    if (!isPlatformAdmin(req.user)) {
      const features = await getResolvedFeatures(companyId);
      const maxBackOfficeUsers = getLimitValue(
        features,
        "maxBackOfficeUsers"
      );

      if (!isUnlimited(maxBackOfficeUsers)) {
        const currentBackOfficeUsers = await User.countDocuments({
          assignedCompanyID: companyId,
          userType: "Super Admin",
          _id: { $ne: req.user._id },
        });

        if (currentBackOfficeUsers >= maxBackOfficeUsers) {
          return redirectToPricingWithUpgradeMessage(
            req,
            res,
            "Your current subscription allows only " +
              maxBackOfficeUsers +
              " Back Office User account(s). Please upgrade your subscription to add more."
          );
        }
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

      if (!isPlatformAdmin(req.user) && !isUnlimited(maxSecurityGuards)) {
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







// WEB LOGIN
// Finds email addresses case-insensitively, then gives Passport the exact
// username value stored in MongoDB. This supports both existing accounts
// saved as "Audu..." and newer accounts saved in lowercase.
app.post("/sign-in", async (req, res, next) => {
  try {
    const enteredEmail = String(req.body.username || "").trim();
    const enteredPassword = String(req.body.password || "");

    if (!enteredEmail || !enteredPassword) {
      req.session.resetModal = {
        title: "Login Failed",
        message: "Please enter your email address and password.",
      };
      return res.redirect("/sign-in");
    }

    // Escape regex characters before performing an exact, case-insensitive lookup.
    const escapedEmail = enteredEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const existingUser = await User.findOne({
      $or: [
        { username: { $regex: `^${escapedEmail}$`, $options: "i" } },
        { email: { $regex: `^${escapedEmail}$`, $options: "i" } },
      ],
    }).select("username email");

    if (!existingUser || !existingUser.username) {
      req.session.resetModal = {
        title: "Login Failed",
        message: "Incorrect email address or password.",
      };
      return res.redirect("/sign-in");
    }

    // Passport Local Mongoose expects the exact username stored in the database.
    req.body.username = existingUser.username;

    passport.authenticate("local", (err, user) => {
      if (err) return next(err);

      if (!user) {
        req.session.resetModal = {
          title: "Login Failed",
          message: "Incorrect email address or password.",
        };
        return res.redirect("/sign-in");
      }

      if (["AmobileGuard", "MobileGuard", "Guard", "Guards"].includes(user.userType)) {
        req.session.resetModal = {
          title: "Mobile App Login Required",
          message: "Guards should log on from the mobile app.",
        };
        return res.redirect("/sign-in");
      }

      if (user.status === false || user.isBlocked === true) {
        req.session.resetModal = {
          title: "Account Blocked",
          message: "Your account has been blocked. Please contact an administrator.",
        };
        return res.redirect("/sign-in");
      }

      return req.logIn(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        req.session.lastLog = new Date();
        return res.redirect(user.userType === "Client" ? "/activities" : "/dashboard");
      });
    })(req, res, next);
  } catch (error) {
    console.error("Sign-in error:", error);
    return next(error);
  }
});

// CREATING GUARD PROFILE Registering

app.post("/add-guard", async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      const companyId = req.session.companyID || req.user?.assignedCompanyID;

      // Restriction
      const features = await getResolvedFeatures(companyId);
      const maxSecurityGuards = getLimitValue(features, "maxSecurityGuards");

      if (!isPlatformAdmin(req.user) && !isUnlimited(maxSecurityGuards)) {
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
        // email: String(username).toLowerCase(),
        email: _.capitalize(username),
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


// CREATE GUARD PROFILE AND EMAIL LOGIN DETAILS
app.post("/add-guard-and-send-details", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.send("Only authenticated users can add guards.");
  }

  try {
    const companyId = req.session.companyID || req.user?.assignedCompanyID;

    // Apply the same subscription guard limit used by the normal Add Guard action.
    const features = await getResolvedFeatures(companyId);
    const maxSecurityGuards = getLimitValue(features, "maxSecurityGuards");

    if (!isPlatformAdmin(req.user) && !isUnlimited(maxSecurityGuards)) {
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
      password,
      cpassword,
      phone,
      clientId,
      siteId,
    } = req.body;

    const firstName = String(fname || "").trim();
    const lastName = String(lname || "").trim();
    // const email = String(username || "").trim().toLowerCase();
    const email = String(username || "").trim();
    const mobile = String(phone || "").trim();
    const temporaryPassword = String(password || "");

    if (!firstName || !lastName || !email || !mobile || !temporaryPassword) {
      req.session.guardtoast = {
        status: false,
        message: "Please complete the guard name, email, phone number and password.",
      };
      return res.redirect("/new-guards");
    }

    if (temporaryPassword !== String(cpassword || "")) {
      req.session.guardtoast = {
        status: false,
        message: "Password and confirm password do not match.",
      };
      return res.redirect("/new-guards");
    }

    if (!clientId || !siteId) {
      req.session.guardtoast = {
        status: false,
        message: "Please select a client and post site before creating the guard.",
      };
      return res.redirect("/new-guards");
    }

    const company = await Company.findById(companyId);
    if (!company) {
      throw new Error("Company not found.");
    }

    const selectedClient = await User.findOne({
      _id: clientId,
      assignedCompanyID: companyId,
      userType: "Client",
    }).select("fullname");

    const selectedPostSite = company.postSite?.find(
      (site) => String(site._id) === String(siteId)
    );

    if (!selectedClient) {
      req.session.guardtoast = {
        status: false,
        message: "The selected client could not be found.",
      };
      return res.redirect("/new-guards");
    }

    if (!selectedPostSite) {
      req.session.guardtoast = {
        status: false,
        message: "The selected post site could not be found.",
      };
      return res.redirect("/new-guards");
    }

    const fullName = `${_.capitalize(firstName)} ${_.capitalize(lastName)}`;
    const clientName = selectedClient.fullname || "Assigned Client";
    const postSiteName = selectedPostSite.siteName || "Assigned Post Site";

    const newGuard = new User({
      username: email,
      fullname: fullName,
      email,
      userType: "AmobileGuard",
      phone: mobile,
      assignedCompanyID: companyId,
      compName: company.companyName || req.user.compName,
      guardClients: [
        {
          name: clientName,
          id: String(clientId),
        },
      ],
      guardPostSite: [
        {
          siteName: postSiteName,
          postSiteID: String(siteId),
        },
      ],
      status: true,
    });

    const createdGuard = await User.register(newGuard, temporaryPassword);
    await addingGuardstoPostSite(createdGuard, companyId);

    const playStoreUrl =
      process.env.GUARD_APP_PLAY_STORE_URL ||
      "https://play.google.com/store/apps";

    const templatePath = path.join(
      __dirname,
      "guard-login-details-email.html"
    );
    const templateSource = fs.readFileSync(templatePath, "utf8");
    const renderTemplate = handlebars.compile(templateSource);

    const emailHtml = renderTemplate({
      firstName,
      lastName,
      fullName,
      email,
      phone: mobile,
      password: temporaryPassword,
      clientName,
      postSiteName,
      companyName: company.companyName || req.user.compName || "WatchTeam",
      playStoreUrl,
    });

    try {
      await emailSent({
        sendTo: email,
        title: "Your WatchTeam Guard App Login Details",
        message:
          `Hello ${firstName}, your WatchTeam guard account has been created. ` +
          `Download the Guard App, sign in with ${email}, and change your temporary password after login.`,
        template: emailHtml,
        emailType: "Guard Login Details",
      });

      req.session.guardtoast = {
        status: true,
        message: "Guard created successfully and login details were emailed.",
      };
    } catch (emailError) {
      console.error("Guard created but email failed:", emailError);
      req.session.guardtoast = {
        status: false,
        message:
          "Guard was created, but the login-details email could not be sent. Please verify the mail configuration and resend the details.",
      };
    }

    return res.redirect("/guards");
  } catch (err) {
    console.error("Guard registration and email error:", err);

    req.session.guardtoast = {
      status: false,
      message: "Error registering Guard: " + err.message,
    };

    return res.redirect("/new-guards");
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

