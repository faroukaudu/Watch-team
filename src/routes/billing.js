const express = require("express");
const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const UserSubscription = require("../src/models/UserSubscription");
const UserSubscriptionEvent = require("../src/models/UserSubscriptionEvent");
const { PLAN_CONFIG } = require("../src/config/subscriptionPlans");
const { STRIPE_PRICE_MAP } = require("../src/config/stripePlans");
const { PAYPAL_PLAN_MAP } = require("../src/config/paypalPlans");

const app = express.App();

