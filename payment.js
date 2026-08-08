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
    const companyId = String(req.user?.assignedCompanyID || "");

    // IMPORTANT: selecting an upgrade must never disable the plan the customer
    // already paid for. Keep the current subscription untouched until Stripe
    // confirms the replacement subscription is active.
    const currentSubscription = await UserSubscription.findOne({
      userId: req.user._id,
      companyId,
    }).sort({ createdAt: -1 }).lean();

    const previousStripeSubscriptionId =
      currentSubscription?.gateway === "stripe" && currentSubscription?.isActive
        ? String(currentSubscription.stripeSubscriptionId || "")
        : "";

    const checkoutParams = {
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/billing/success?gateway=stripe&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/billing/cancel?gateway=stripe`,
      metadata: {
        planCode,
        userId: String(req.user?._id || ""),
        companyId,
        username: String(req.user?.fullname || req.user?.username || ""),
        email: String(req.user?.email || ""),
        previousStripeSubscriptionId,
      },
      subscription_data: {
        metadata: {
          planCode,
          userId: String(req.user?._id || ""),
          companyId,
          username: String(req.user?.fullname || req.user?.username || ""),
          email: String(req.user?.email || ""),
          previousStripeSubscriptionId,
        },
      },
    };

    // Reuse the Stripe customer only if it exists for the Stripe account/mode
    // represented by the currently configured secret key. A customer ID saved
    // from test mode, another Stripe account, or a deleted customer will cause
    // Checkout to fail with `No such customer`. In that case, clear the stale
    // ID and let Stripe create a fresh customer from the signed-in user's email.
    let reusableStripeCustomerId = String(currentSubscription?.stripeCustomerId || "").trim();

    if (reusableStripeCustomerId) {
      try {
        const stripeCustomer = await stripe.customers.retrieve(reusableStripeCustomerId);

        if (stripeCustomer && !stripeCustomer.deleted) {
          checkoutParams.customer = reusableStripeCustomerId;
        } else {
          reusableStripeCustomerId = "";
        }
      } catch (customerError) {
        if (customerError?.code === "resource_missing" && customerError?.param === "customer") {
          console.warn(
            `Saved Stripe customer ${reusableStripeCustomerId} does not exist for the current Stripe account/mode. Creating a new customer instead.`
          );
          reusableStripeCustomerId = "";
        } else {
          throw customerError;
        }
      }
    }

    if (!reusableStripeCustomerId) {
      // Remove the bad reference so future checkouts do not repeatedly attempt it.
      if (currentSubscription?.stripeCustomerId) {
        await UserSubscription.updateOne(
          { userId: req.user._id, companyId },
          { $set: { stripeCustomerId: "" } }
        );
      }

      if (req.user?.email) {
        checkoutParams.customer_email = req.user.email;
      }
    }

    const session = await stripe.checkout.sessions.create(checkoutParams);

    // Save only the checkout reference. Do NOT change isActive/status/plan here.
    // If checkout is cancelled, the existing subscription remains fully usable.
    await UserSubscription.updateOne(
      { userId: req.user._id, companyId },
      { $set: { stripeCheckoutSessionId: session.id } }
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
async function activateStripeCheckoutForUser({ sessionId, user }) {
  if (!stripe) throw new Error("Stripe is not configured.");
  if (!sessionId) throw new Error("Missing Stripe checkout session id.");

  // Expand the subscription so the success redirect can synchronize the DB
  // immediately instead of waiting for the webhook to arrive first.
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription"],
  });

  if (!session || session.mode !== "subscription") {
    throw new Error("Stripe checkout session is not a subscription session.");
  }

  if (session.status !== "complete") {
    throw new Error(`Stripe checkout is not complete (status: ${session.status || "unknown"}).`);
  }

  let stripeSub = session.subscription;
  if (typeof stripeSub === "string") {
    stripeSub = await stripe.subscriptions.retrieve(stripeSub);
  }

  if (!stripeSub || !stripeSub.id) {
    throw new Error("Stripe did not return the subscription for this checkout.");
  }

  // Merge both metadata sources. An empty subscription metadata object is
  // truthy in JS, so using `stripeSub.metadata || session.metadata` can hide
  // valid Checkout metadata.
  const metadata = {
    ...(session.metadata || {}),
    ...(stripeSub.metadata || {}),
  };

  const planCode = String(metadata.planCode || "");
  const plan = PLAN_CONFIG[planCode];
  if (!plan) {
    throw new Error(`Unknown WatchTeam plan from Stripe metadata: ${planCode || "missing"}.`);
  }

  const expectedUserId = String(user?._id || "");
  const expectedCompanyId = String(user?.assignedCompanyID || "");
  const metadataUserId = String(metadata.userId || "");
  const metadataCompanyId = String(metadata.companyId || "");

  // Never let a logged-in user activate somebody else's Checkout session.
  if (metadataUserId && metadataUserId !== expectedUserId) {
    throw new Error("Stripe checkout does not belong to the signed-in user.");
  }
  if (metadataCompanyId && metadataCompanyId !== expectedCompanyId) {
    throw new Error("Stripe checkout does not belong to the signed-in company.");
  }

  const usableStatuses = ["active", "trialing"];
  if (!usableStatuses.includes(stripeSub.status)) {
    throw new Error(`Stripe subscription is not active yet (status: ${stripeSub.status || "unknown"}).`);
  }

  // For normal card Checkout this will be paid. Trials can legitimately be
  // no_payment_required, so either is acceptable when Stripe says the
  // subscription itself is active/trialing.
  const acceptedPaymentStatuses = ["paid", "no_payment_required"];
  if (session.payment_status && !acceptedPaymentStatuses.includes(session.payment_status)) {
    throw new Error(`Stripe payment is not confirmed (payment_status: ${session.payment_status}).`);
  }

  const now = new Date();
  const expiresAt = stripeSub.current_period_end
    ? new Date(stripeSub.current_period_end * 1000)
    : getExpiryDateFromPlan(plan);

  const subscription = await UserSubscription.findOneAndUpdate(
    {
      userId: user._id,
      companyId: expectedCompanyId,
    },
    {
      $set: {
        userId: user._id,
        companyId: expectedCompanyId,
        username: String(user.fullname || user.username || ""),
        email: String(user.email || ""),
        gateway: "stripe",
        planCode,
        planName: plan.planName,
        billingCycle: plan.billingCycle,
        amount: plan.amount,
        currency: plan.currency,
        commitmentMonths: plan.commitmentMonths || 1,
        features: plan.features,
        subscriptionStatus: stripeSub.status,
        isActive: true,
        status: "active",
        stripeCheckoutSessionId: session.id,
        stripeCustomerId:
          typeof stripeSub.customer === "string"
            ? stripeSub.customer
            : stripeSub.customer?.id || "",
        stripeSubscriptionId: stripeSub.id,
        startsAt: stripeSub.start_date
          ? new Date(stripeSub.start_date * 1000)
          : now,
        expiresAt,
        canceledAt: null,
        lastSuccessfulPaymentAt: session.payment_status === "paid" ? now : null,
        rawGatewayPayload: stripeSub,
      },
    },
    { upsert: true, new: true, runValidators: true }
  );

  if (!subscription || !subscription.isActive || !usableStatuses.includes(subscription.subscriptionStatus)) {
    throw new Error("WatchTeam could not activate the subscription after Stripe payment.");
  }

  // Once the replacement plan is truly active in our DB, retire the previous
  // Stripe subscription. Do this last so a cancellation failure cannot prevent
  // access to the newly-paid plan.
  const previousId = String(metadata.previousStripeSubscriptionId || "");
  if (previousId && previousId !== stripeSub.id) {
    try {
      await stripe.subscriptions.cancel(previousId);
    } catch (cancelError) {
      console.error("Unable to cancel previous Stripe subscription:", cancelError.message);
    }
  }

  return subscription;
}

app.get("/billing/success", async (req, res) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.redirect("/sign-in");
    }

    const { gateway, session_id } = req.query;
    let subscription = null;

    if (gateway === "stripe") {
      if (!session_id) {
        return res.status(400).send("Stripe returned without a checkout session id.");
      }

      // The redirect is now a real synchronization point. If Stripe confirms
      // success, WatchTeam activates the plan here even if the webhook has not
      // arrived yet.
      subscription = await activateStripeCheckoutForUser({
        sessionId: session_id,
        user: req.user,
      });
    } else {
      subscription = await UserSubscription.findOne({
        userId: req.user._id,
        companyId: String(req.user.assignedCompanyID || ""),
      });
    }

    return res.render("dashboard/billing-success", {
      userInfo: req.user,
      message: "Your subscription payment was completed successfully.",
      subscription: subscription
        ? (subscription.toObject ? subscription.toObject() : subscription)
        : null,
      gateway: gateway || "",
    });
  } catch (err) {
    console.error("billing success activation error:", err);

    // Do not display a false success page. The webhook can still reconcile a
    // legitimate Stripe payment, but the browser should clearly report that
    // WatchTeam has not activated access yet.
    return res.status(409).render("dashboard/billing-cancel", {
      userInfo: req.user,
      message: `Payment returned from Stripe, but WatchTeam could not activate the subscription yet. ${err.message}`,
    });
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

    const subscriptionNotice = req.session.subscriptionNotice || null;
    delete req.session.subscriptionNotice;

    return res.render("dashboard/my-subscription", {
      userInfo: req.user,
      subscription,
      subscriptionNotice,
    });
  } catch (err) {
    console.error("my-subscription page error:", err);
    return res.status(500).send("Unable to load subscription page.");
  }
});

// --------------------------------------------------
// Cancel current subscription immediately
// --------------------------------------------------
app.post("/billing/cancel-subscription", async (req, res) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.redirect("/sign-in");
    }

    const companyId = String(req.user.assignedCompanyID || "");
    const subscription = await UserSubscription.findOne({
      userId: req.user._id,
      companyId,
    });

    if (!subscription) {
      req.session.subscriptionNotice = "No subscription was found to cancel.";
      return res.redirect("/my-subscription");
    }

    if (!subscription.isActive || ["canceled", "expired"].includes(subscription.subscriptionStatus)) {
      req.session.subscriptionNotice = "This subscription is already inactive.";
      return res.redirect("/my-subscription");
    }

    // Cancel the recurring Stripe subscription first. Cancellation is immediate
    // because the confirmation modal explicitly warns that remaining access will
    // be forfeited. If the saved Stripe ID belongs to an old sandbox/account,
    // Stripe returns resource_missing; in that migration case we still void the
    // local WatchTeam subscription so the user can start a clean live plan.
    if (subscription.gateway === "stripe" && subscription.stripeSubscriptionId) {
      if (!stripe) {
        return res.status(500).send("Stripe is not configured. Subscription was not cancelled.");
      }

      try {
        await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
      } catch (stripeError) {
        if (stripeError?.code !== "resource_missing") {
          console.error("Stripe subscription cancellation error:", stripeError);
          return res.status(502).send("Stripe could not cancel the subscription. No changes were made in WatchTeam.");
        }

        console.warn(
          `Stripe subscription ${subscription.stripeSubscriptionId} was not found in the current Stripe environment. Voiding the local WatchTeam subscription.`
        );
      }
    } else if (subscription.gateway === "paypal" && subscription.paypalSubscriptionId) {
      // PayPal cancellation API is not configured in this payment module yet.
      // Do not claim success locally while PayPal could continue recurring billing.
      return res.status(400).send(
        "PayPal cancellation is not configured yet. Please cancel the PayPal subscription from PayPal management first."
      );
    }

    const now = new Date();
    subscription.isActive = false;
    subscription.subscriptionStatus = "canceled";
    subscription.canceledAt = now;
    subscription.expiresAt = now;
    await subscription.save();

    req.session.subscriptionNotice = "Your subscription has been cancelled and access ended immediately.";
    return res.redirect("/my-subscription");
  } catch (err) {
    console.error("Cancel subscription error:", err);
    return res.status(500).send("Unable to cancel subscription.");
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



// Cancle sub
app.get("/billing/cancel", async (req, res) => {
  try {
    // const gateway = req.query.gateway || "stripe";

    return res.render("dashboard/billing-cancel", {
      userInfo: req.user,
      gateway
    });

  } catch (err) {
    console.error("Billing cancel page error:", err);

    return res.status(500).send("Unable to load cancellation page.");
  }
});


module.exports = app;