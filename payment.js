const myModule = require("./index.js");
require('dotenv').config();
const UserSubscription = require("./src/models/UserSubscription");
const { PLAN_CONFIG } = require("./src/config/subscriptionPlans");

const app = myModule.main;

// --------------------------------------------------
// Helpers
// --------------------------------------------------


function ensureAuth(req, res) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    res.redirect("/sign-in");
    return false;
  }
  return true;
}

function getExpiryDateFromPlan(plan) {
  const now = new Date();
  const expiresAt = new Date(now);

  if (plan.billingCycle === "monthly") {
    expiresAt.setMonth(expiresAt.getMonth() + 1);
  } else if (plan.billingCycle === "yearly") {
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  }

  return expiresAt;
}

// --------------------------------------------------
// Pricing page
// --------------------------------------------------
// app.get("/pricing", (req, res) => {
//   if (!req.isAuthenticated || !req.isAuthenticated()) {
//     return res.redirect("/sign-in");
//   }

//   const subscriptionNotice = req.session.subscriptionNotice || "";
//   delete req.session.subscriptionNotice;

//   res.render("dashboard/pricing", {
//     userInfo: req.user,
//     subscriptionNotice,
//   });
// });

app.get("/pricing", async (req, res) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.redirect("/sign-in");
  }

  const upgradeMessage = req.session.upgradeMessage || null;
  req.session.upgradeMessage = null;

  return res.render("dashboard/pricing", {
    userInfo: req.user,
    upgradeMessage,
  });
});

// --------------------------------------------------
// Select payment gateway page
// --------------------------------------------------
app.get("/select-payment", (req, res) => {
  if (!ensureAuth(req, res)) return;

  const { plan } = req.query;
  const selectedPlan = PLAN_CONFIG[plan];

  if (!selectedPlan) {
    return res.redirect("/pricing");
  }

  return res.render("dashboard/select-payment", {
    userInfo: req.user,
    selectedPlan,
    planCode: plan,
  });
});

// --------------------------------------------------
// Stripe
// --------------------------------------------------
const Stripe = require("stripe");

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("STRIPE_SECRET_KEY is missing. Stripe checkout routes will fail until it is added.");
}

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const STRIPE_PRICE_MAP = {
  essential_monthly: process.env.ESSENTIALS_MONTHLY,
  advanced_monthly: process.env.ADVANCE_MONTHLY,
  professional_monthly: process.env.PROFESSIONAL_MONTHLY,
  essential_yearly: process.env.ESSENTIALS_YEALY,
  advanced_yearly: process.env.ADVANCE_YEARLY,
  professional_yearly: process.env.PROFESSIONAL_YEARLY
};


app.post("/billing/stripe/checkout", async (req, res) => {
  try {
    if (!ensureAuth(req, res)) return;

    if (!stripe) {
      return res.status(500).send("Stripe is not configured. Add STRIPE_SECRET_KEY to your environment.");
    }

    const { planCode } = req.body;
    const plan = PLAN_CONFIG[planCode];
    const priceId = STRIPE_PRICE_MAP[planCode];

    if (!plan || !priceId) {
      return res.redirect("/pricing");
    }

    const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/billing/success?gateway=stripe&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/billing/cancel?gateway=stripe`,
      customer_email: req.user?.email || undefined,
      metadata: {
        planCode,
        userId: String(req.user?._id || ""),
        companyId: String(req.user?.assignedCompanyID || ""),
        username: String(req.user?.fullname || req.user?.username || ""),
        email: String(req.user?.email || ""),
      },
      subscription_data: {
        metadata: {
          planCode,
          userId: String(req.user?._id || ""),
          companyId: String(req.user?.assignedCompanyID || ""),
          username: String(req.user?.fullname || req.user?.username || ""),
          email: String(req.user?.email || ""),
        },
      },
    });

    await UserSubscription.findOneAndUpdate(
      {
        userId: req.user._id,
        companyId: String(req.user.assignedCompanyID || ""),
      },
      {
        $set: {
          userId: req.user._id,
          companyId: String(req.user.assignedCompanyID || ""),
          username: String(req.user.fullname || req.user.username || ""),
          email: String(req.user.email || ""),
          gateway: "stripe",
          planCode,
          planName: plan.planName,
          billingCycle: plan.billingCycle,
          amount: plan.amount,
          currency: plan.currency,

          // keep your current fields
          subscriptionStatus: "pending",
          isActive: false,

          // add this for compatibility with your limits helper
          status: "pending",

          startsAt: null,
          expiresAt: null,
          canceledAt: null,
          stripeCheckoutSessionId: session.id,
          features: plan.features,
        },
      },
      { upsert: true, new: true }
    );

    return res.redirect(303, session.url);
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return res.status(500).send("Unable to start Stripe subscription checkout.");
  }
});

// --------------------------------------------------
// PayPal
// --------------------------------------------------
const PAYPAL_PLAN_MAP = {
  essential_monthly: "P-ESSENTIAL-MONTHLY-SANDBOX",
  advanced_monthly: "P-ADVANCED-MONTHLY-SANDBOX",
  professional_monthly: "P-PROFESSIONAL-MONTHLY-SANDBOX",
  essential_yearly: "P-ESSENTIAL-YEARLY-SANDBOX",
  advanced_yearly: "P-ADVANCED-YEARLY-SANDBOX",
  professional_yearly: "P-PROFESSIONAL-YEARLY-SANDBOX",
};

app.get("/billing/paypal/checkout", (req, res) => {
  if (!ensureAuth(req, res)) return;

  const { planCode } = req.query;
  const selectedPlan = PLAN_CONFIG[planCode];
  const paypalPlanId = PAYPAL_PLAN_MAP[planCode];

  if (!selectedPlan || !paypalPlanId) {
    return res.redirect("/pricing");
  }

  return res.render("dashboard/paypal-subscription", {
    userInfo: req.user,
    planCode,
    selectedPlan,
    paypalClientId: process.env.PAYPAL_CLIENT_ID,
    paypalPlanId,
  });
});

app.get("/billing/paypal/success", async (req, res) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.redirect("/sign-in");
    }

    const { subscription_id, planCode } = req.query;
    const plan = PLAN_CONFIG[planCode];
    const paypalPlanId = PAYPAL_PLAN_MAP[planCode];

    if (!subscription_id || !plan || !paypalPlanId) {
      return res.redirect("/pricing");
    }

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 30); // test rule for now

    const subscription = await UserSubscription.findOneAndUpdate(
      {
        userId: req.user._id,
        companyId: String(req.user.assignedCompanyID || ""),
      },
      {
        $set: {
          userId: req.user._id,
          companyId: String(req.user.assignedCompanyID || ""),
          username: String(req.user.fullname || req.user.username || ""),
          email: String(req.user.email || ""),
          gateway: "paypal",
          planCode,
          planName: plan.planName,
          billingCycle: plan.billingCycle,
          amount: plan.amount,
          currency: plan.currency,

          // keep your current fields
          subscriptionStatus: "active",
          isActive: true,

          // add this for compatibility
          status: "active",

          startsAt: now,
          expiresAt,
          canceledAt: null,
          paypalSubscriptionId: String(subscription_id),
          paypalPlanId: String(paypalPlanId),
          features: plan.features,
        },
      },
      { upsert: true, new: true }
    );

    return res.render("dashboard/billing-success", {
      userInfo: req.user,
      message: "PayPal test subscription approved successfully.",
      subscription,
      gateway: "paypal",
    });
  } catch (err) {
    console.error("PayPal success error:", err);
    return res.status(500).send("Unable to complete PayPal subscription.");
  }
});

// --------------------------------------------------
// Generic success/cancel pages
// --------------------------------------------------
app.get("/billing/success", async (req, res) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.redirect("/sign-in");
    }

    const { gateway, session_id } = req.query;

    let subscription = await UserSubscription.findOne({
      userId: req.user._id,
      companyId: String(req.user.assignedCompanyID || ""),
    });

    if (gateway === "stripe" && session_id && stripe) {
      const session = await stripe.checkout.sessions.retrieve(session_id);

      if (session && session.subscription) {
        const stripeSub = await stripe.subscriptions.retrieve(session.subscription);

        const now = new Date();
        const expiresAt = new Date(now);
        expiresAt.setDate(expiresAt.getDate() + 30); // test rule for now

        subscription = await UserSubscription.findOneAndUpdate(
          {
            userId: req.user._id,
            companyId: String(req.user.assignedCompanyID || ""),
          },
          {
            $set: {
              gateway: "stripe",
              subscriptionStatus: "active",
              isActive: true,
              status: "active",
              stripeCustomerId: stripeSub.customer || "",
              stripeSubscriptionId: stripeSub.id || "",
              startsAt: now,
              expiresAt,
              canceledAt: null,
              rawGatewayPayload: stripeSub,
            },
          },
          { new: true }
        );
      }
    }

    return res.render("dashboard/billing-success", {
      userInfo: req.user,
      message: "Your subscription payment was completed successfully.",
      subscription: subscription ? (subscription.toObject ? subscription.toObject() : subscription) : null,
      gateway: gateway || "",
    });
  } catch (err) {
    console.error("billing success page error:", err);
    return res.status(500).send("Unable to load billing success page.");
  }
});
    
app.get("/billing/cancel", (req, res) => {
  if (!ensureAuth(req, res)) return;

  return res.render("dashboard/billing-cancel", {
    userInfo: req.user,
    message: "Subscription checkout was cancelled.",
  });
});

// --------------------------------------------------
// Subscription summary page
// --------------------------------------------------
app.get("/my-subscription", async (req, res) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.redirect("/sign-in");
    }

    const subscription = await UserSubscription.findOne({
      userId: req.user._id,
      companyId: String(req.user.assignedCompanyID || ""),
    }).lean();

    return res.render("dashboard/my-subscription", {
      userInfo: req.user,
      subscription,
    });
  } catch (err) {
    console.error("my-subscription page error:", err);
    return res.status(500).send("Unable to load subscription page.");
  }
});

// Store Stripe Card
app.post("/billing/stripe/portal", async (req, res) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.redirect("/sign-in");
    }

    if (!stripe) {
      return res.status(500).send("Stripe is not configured.");
    }

    const subscription = await UserSubscription.findOne({
      userId: req.user._id,
      companyId: String(req.user.assignedCompanyID || ""),
      gateway: "stripe",
    }).lean();

    if (!subscription || !subscription.stripeCustomerId) {
      return res.status(400).send("No Stripe customer found for this subscription.");
    }

    const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${baseUrl}/my-subscription`,
    });

    return res.redirect(303, portalSession.url);
  } catch (err) {
    console.error("Stripe portal error:", err);
    return res.status(500).send("Unable to open Stripe billing portal.");
  }
});

// store Paypal Card
app.get("/billing/paypal/manage", async (req, res) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.redirect("/sign-in");
    }

    const subscription = await UserSubscription.findOne({
      userId: req.user._id,
      companyId: String(req.user.assignedCompanyID || ""),
      gateway: "paypal",
    }).lean();

    if (!subscription || !subscription.paypalSubscriptionId) {
      return res.status(400).send("No PayPal subscription found.");
    }

    return res.send(`
      <h2>PayPal Subscription Management</h2>
      <p>Subscription ID: ${subscription.paypalSubscriptionId}</p>
      <p>For test mode, manage the subscription in PayPal Sandbox or add API-based revise/cancel management next.</p>
      <p><a href="/my-subscription">Back to My Subscription</a></p>
    `);
  } catch (err) {
    console.error("PayPal manage error:", err);
    return res.status(500).send("Unable to open PayPal management.");
  }
});

// billing method
app.get("/billing/payment-method", async (req, res) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.redirect("/sign-in");
    }

    const subscription = await UserSubscription.findOne({
      userId: req.user._id,
      companyId: String(req.user.assignedCompanyID || ""),
      gateway: "stripe",
    }).lean();

    if (!subscription || !subscription.stripeCustomerId) {
      return res.render("dashboard/manage-card", {
        userInfo: req.user,
        card: null,
        subscription,
      });
    }

    const paymentMethods = await stripe.paymentMethods.list({
      customer: subscription.stripeCustomerId,
      type: "card",
    });

    const card = paymentMethods.data.length > 0
      ? paymentMethods.data[0].card
      : null;

    return res.render("dashboard/manage-card", {
      userInfo: req.user,
      card,
      subscription,
    });
  } catch (err) {
    console.error("Fetch card error:", err);
    return res.status(500).send("Unable to load card details.");
  }
});

// admin route
app.get("/admin/subscriptions", async (req, res) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.redirect("/sign-in");
    }

    // Optional: tighten this to your own admin role logic
    if (req.user.userType !== "Super Admin") {
      return res.status(403).send("Unauthorized");
    }

    const subscriptions = await UserSubscription.find({})
      .sort({ createdAt: -1 })
      .lean();

    return res.render("dashboard/admin-subscriptions", {
      userInfo: req.user,
      subscriptions,
    });
  } catch (err) {
    console.error("Admin subscriptions page error:", err);
    return res.status(500).send("Unable to load subscriptions.");
  }
});


module.exports = app;