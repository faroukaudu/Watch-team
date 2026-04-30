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
const UserSubscriptionEvent = require("./src/models/UserSubscriptionEvent");

const app = myModule.main;
const User = myModule.userDB;
const Company = mongoose.model("Company", companyInfo);



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
        const metadata = stripeSub.metadata || session.metadata || {};

        const now = new Date();
        const expiresAt = new Date(now);
        expiresAt.setDate(expiresAt.getDate() + 30); // your current test rule

        await UserSubscription.findOneAndUpdate(
          {
            userId: metadata.userId,
            companyId: String(metadata.companyId || ""),
          },
          {
            $set: {
              username: metadata.username || "",
              email: metadata.email || "",
              gateway: "stripe",
              planCode: metadata.planCode || "",
              subscriptionStatus: stripeSub.status || "active",
              isActive: ["active", "trialing"].includes(stripeSub.status),
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
      }
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated"
    ) {
      const stripeSub = dataObject;
      const metadata = stripeSub.metadata || {};

      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setDate(expiresAt.getDate() + 30); // current test rule

      await UserSubscription.findOneAndUpdate(
        {
          userId: metadata.userId,
          companyId: String(metadata.companyId || ""),
        },
        {
          $set: {
            username: metadata.username || "",
            email: metadata.email || "",
            gateway: "stripe",
            planCode: metadata.planCode || "",
            subscriptionStatus: stripeSub.status || "active",
            isActive: ["active", "trialing"].includes(stripeSub.status),
            stripeCustomerId: stripeSub.customer || "",
            stripeSubscriptionId: stripeSub.id || "",
            startsAt: new Date(),
            expiresAt,
            canceledAt: null,
            rawGatewayPayload: stripeSub,
          },
        },
        { upsert: true, new: true }
      );
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

