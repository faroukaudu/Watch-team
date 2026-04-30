const myModule = require('./index.js');
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const passport = require("passport");
const session = require("express-session");
const _ = require('lodash');
var companyInfo = require(__dirname + "/db/companyinfodb.js");
const adminCreatePassword = require('./msg_send.js');
const addingGuardstoPostSite = require("./add_gaurd.js");




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


app.post("/sign-up", (req, res) => {
  console.log("signing up");

  console.log(req.body.company_name, req.body.full_name, req.body.password, req.body.cpassword);
  req.body.username = _.capitalize(req.body.username);
  // console.log(req.body.email);
  User.register(new User({
    username: req.body.username,
    fullname: _.capitalize(req.body.full_name),
    compName: _.capitalize(req.body.company_name),
    email: _.capitalize(req.body.username),
    userType: "Super Admin",
    status: true,


  }), req.body.password,
    async function (err, user) {
      if (!err) {
        // Creating a Company
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
          console.log(comp.companyName, "Company Created");



          passport.authenticate("local", {
            failureRedirect: '/error991',
            failureMessage: true
          })(req, res, function () {

            // setTimeout(function() {
            res.redirect("/sign-in");
            // res.send("User Registred");
            // welcomeEmail({username:req.body.firstname, email:req.body.username});
            // }, 2000);
          });
        } catch (err) {
          console.log("Company not Created", err);
          res.status(500).send("Company creation failed");
        }
        // Try Catch Error for creating Company
      } else {
        res.send(err)
        // res.render("userdash/animations/usererr", {errorMsg:"Registration Error!!!"});
      }

    })

})


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
        res.redirect("/dashboard");
      })
    } else {
      // res.render("userdash/animations/usererr", {errorMsg:"Invalid Login Details !!!"});
      res.send("error login", err)
    }
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

