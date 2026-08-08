const myModule = require('./index.js');
const bodyParser = require("body-parser");
const express = require("express");
const mongoose = require("mongoose");
const passport = require("passport");
const session = require("express-session");
const _ = require('lodash');
var companyInfo = require(__dirname + "/db/companyinfodb.js");
const { ObjectId } = require("mongodb");
const MobileReport = require("./src/models/report.js");
// const UserSubscription = require("./src/models/UserSubscription");
const { PLAN_CONFIG } = require("./src/config/subscriptionPlans");
const UserSubscription = require("./src/models/UserSubscription");
const { emailSent } = require("./nodemailer");
const Stripe = require("stripe");
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const UserSubscriptionEvent = require("./src/models/UserSubscriptionEvent");

const app = myModule.main;
const User = myModule.userDB;
const Company = mongoose.model("Company", companyInfo);



async function notifyPlatformAdmins(subscription, paymentReference) {
  if (!subscription) return;
  const recipients = await User.find({ userType: "Platform Admin", isBlocked: { $ne: true } })
    .select("email username").lean();
  const emails = recipients.map((u) => u.email || u.username).filter(Boolean);
  const fallback = process.env.SUPER_ADMIN_NOTIFICATION_EMAIL;
  if (fallback) emails.push(fallback);
  const uniqueEmails = [...new Set(emails)];
  if (!uniqueEmails.length) return;

  await emailSent({
    sendTo: uniqueEmails.join(","),
    title: `Successful ${subscription.planName || "Watch Team"} subscription payment`,
    message: `A subscription payment was successful for ${subscription.username || subscription.email || subscription.companyId}.`,
    template: `<h3>Subscription Payment Successful</h3>
      <p><strong>Company ID:</strong> ${subscription.companyId || "-"}</p>
      <p><strong>Account:</strong> ${subscription.username || subscription.email || "-"}</p>
      <p><strong>Plan:</strong> ${subscription.planName || "-"} (${subscription.billingCycle || "-"})</p>
      <p><strong>Gateway:</strong> ${subscription.gateway || "-"}</p>
      <p><strong>Amount:</strong> ${subscription.amount || 0} ${subscription.currency || "USD"}</p>
      <p><strong>Payment reference:</strong> ${paymentReference || "-"}</p>`
  });
}

// STRIPE WEBHOOK
app.post("/webhooks/stripe", require("express").raw({ type: "application/json" }), async (req, res) => {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("Missing STRIPE_WEBHOOK_SECRET");
    return res.status(500).send("Webhook secret not configured");
  }

  let event;

  try {
    const signature = req.headers["stripe-signature"];
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Stripe webhook signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    const dataObject = event.data.object;

    await UserSubscriptionEvent.create({
      gateway: "stripe",
      eventType: event.type,
      externalCustomerId: dataObject.customer || "",
      externalSubscriptionId: dataObject.id || dataObject.subscription || "",
      statusAfterEvent: dataObject.status || "",
      payload: dataObject,
    });

    if (event.type === "checkout.session.completed") {
      const session = dataObject;

      if (session.mode === "subscription" && session.subscription) {
        const stripeSub = await stripe.subscriptions.retrieve(session.subscription);
        const metadata = { ...(session.metadata || {}), ...(stripeSub.metadata || {}) };
        const plan = PLAN_CONFIG[metadata.planCode || ""];
        const isPaidAndUsable = ["active", "trialing"].includes(stripeSub.status);

        // Never replace a currently active plan with an incomplete/pending
        // checkout. The old plan remains valid until Stripe confirms success.
        if (plan && isPaidAndUsable) {
          const now = new Date();
          const expiresAt = stripeSub.current_period_end
            ? new Date(stripeSub.current_period_end * 1000)
            : (() => {
                const d = new Date(now);
                if (plan.billingCycle === "yearly") d.setFullYear(d.getFullYear() + 1);
                else d.setMonth(d.getMonth() + 1);
                return d;
              })();

          await UserSubscription.findOneAndUpdate(
            {
              userId: metadata.userId,
              companyId: String(metadata.companyId || ""),
            },
            {
              $set: {
                userId: metadata.userId,
                companyId: String(metadata.companyId || ""),
                username: metadata.username || "",
                email: metadata.email || "",
                gateway: "stripe",
                planCode: metadata.planCode || "",
                planName: plan.planName,
                billingCycle: plan.billingCycle,
                amount: plan.amount,
                currency: plan.currency,
                commitmentMonths: plan.commitmentMonths || 1,
                features: plan.features,
                subscriptionStatus: stripeSub.status,
                isActive: true,
                stripeCheckoutSessionId: session.id || "",
                stripeCustomerId: stripeSub.customer || "",
                stripeSubscriptionId: stripeSub.id || "",
                startsAt: now,
                expiresAt,
                canceledAt: null,
                rawGatewayPayload: stripeSub,
              },
            },
            { upsert: true, new: true }
          );

          const previousId = String(metadata.previousStripeSubscriptionId || "");
          if (previousId && previousId !== stripeSub.id) {
            try {
              await stripe.subscriptions.cancel(previousId);
            } catch (cancelError) {
              console.error("Unable to cancel previous Stripe subscription:", cancelError.message);
            }
          }
        }
      }
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated"
    ) {
      const stripeSub = dataObject;
      const metadata = stripeSub.metadata || {};
      const plan = PLAN_CONFIG[metadata.planCode || ""];
      const usable = ["active", "trialing"].includes(stripeSub.status);

      // A newly-created Checkout subscription can briefly be "incomplete".
      // Do not let that transient state deactivate the customer's old plan.
      const current = await UserSubscription.findOne({
        userId: metadata.userId,
        companyId: String(metadata.companyId || ""),
      }).lean();
      const eventBelongsToCurrent = current?.stripeSubscriptionId === stripeSub.id;

      if (plan && (usable || eventBelongsToCurrent)) {
        const now = new Date();
        const expiresAt = stripeSub.current_period_end
          ? new Date(stripeSub.current_period_end * 1000)
          : (() => {
              const d = new Date(now);
              if (plan.billingCycle === "yearly") d.setFullYear(d.getFullYear() + 1);
              else d.setMonth(d.getMonth() + 1);
              return d;
            })();

        await UserSubscription.findOneAndUpdate(
          {
            userId: metadata.userId,
            companyId: String(metadata.companyId || ""),
          },
          {
            $set: {
              username: metadata.username || current?.username || "",
              email: metadata.email || current?.email || "",
              gateway: "stripe",
              planCode: metadata.planCode || current?.planCode || "",
              planName: plan.planName,
              billingCycle: plan.billingCycle,
              amount: plan.amount,
              currency: plan.currency,
              commitmentMonths: plan.commitmentMonths || 1,
              features: plan.features,
              subscriptionStatus: stripeSub.status || "active",
              isActive: usable,
              stripeCustomerId: stripeSub.customer || "",
              stripeSubscriptionId: stripeSub.id || "",
              startsAt: current?.startsAt || now,
              expiresAt,
              canceledAt: usable ? null : current?.canceledAt || null,
              rawGatewayPayload: stripeSub,
            },
          },
          { upsert: usable, new: true }
        );
      }
    }

    if (event.type === "invoice.paid") {
      const invoice = dataObject;
      const stripeSubscriptionId = typeof invoice.subscription === "string"
        ? invoice.subscription
        : invoice.subscription?.id || "";
      const subscription = await UserSubscription.findOneAndUpdate(
        { stripeSubscriptionId },
        {
          $set: {
            isActive: true,
            subscriptionStatus: "active",
            lastSuccessfulPaymentAt: new Date(),
          },
          $inc: { renewalCount: 1 },
        },
        { new: true }
      );
      await notifyPlatformAdmins(subscription, invoice.id || invoice.payment_intent || "");
    }

    if (event.type === "customer.subscription.deleted") {
      const stripeSub = dataObject;

      await UserSubscription.findOneAndUpdate(
        {
          stripeSubscriptionId: stripeSub.id || "",
        },
        {
          $set: {
            subscriptionStatus: "canceled",
            isActive: false,
            canceledAt: new Date(),
            rawGatewayPayload: stripeSub,
          },
        }
      );
    }

    return res.json({ received: true });
  } catch (err) {
    console.error("Stripe webhook processing error:", err);
    return res.status(500).send("Webhook handler failed.");
  }
});


// PAYPALWEBHOOK
app.post("/webhooks/paypal", express.json(), async (req, res) => {
  try {
    const event = req.body;
    const eventType = event.event_type;
    const resource = event.resource || {};

    await UserSubscriptionEvent.create({
      gateway: "paypal",
      eventType,
      externalSubscriptionId: resource.id || "",
      payload: event,
    });

    if (
      eventType === "BILLING.SUBSCRIPTION.ACTIVATED" ||
      eventType === "BILLING.SUBSCRIPTION.UPDATED"
    ) {
      await UserSubscription.findOneAndUpdate(
        { paypalSubscriptionId: resource.id || "" },
        {
          $set: {
            subscriptionStatus: "active",
            isActive: true,
            rawGatewayPayload: event,
          },
        }
      );
    }

    if (eventType === "PAYMENT.SALE.COMPLETED") {
      const paypalSubscriptionId = resource.billing_agreement_id || resource.supplementary_data?.related_ids?.billing_agreement_id || "";
      const subscription = await UserSubscription.findOneAndUpdate(
        { paypalSubscriptionId },
        { $set: { isActive: true, subscriptionStatus: "active", lastSuccessfulPaymentAt: new Date() }, $inc: { renewalCount: 1 } },
        { new: true }
      );
      await notifyPlatformAdmins(subscription, resource.id || "");
    }

    if (
      eventType === "BILLING.SUBSCRIPTION.CANCELLED" ||
      eventType === "BILLING.SUBSCRIPTION.EXPIRED" ||
      eventType === "BILLING.SUBSCRIPTION.SUSPENDED"
    ) {
      await UserSubscription.findOneAndUpdate(
        { paypalSubscriptionId: resource.id || "" },
        {
          $set: {
            subscriptionStatus: "canceled",
            isActive: false,
            canceledAt: new Date(),
            rawGatewayPayload: event,
          },
        }
      );
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error("PayPal webhook error:", err);
    return res.sendStatus(500);
  }
});

