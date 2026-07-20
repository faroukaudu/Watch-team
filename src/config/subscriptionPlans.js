function fullFeatures({
  maxClients,
  maxSecurityGuards,
  maxPostSites,
  maxBackOfficeUsers,
}) {
  return {
    // Platform Admin does not use these limits; Platform Admin bypasses all limits.
    maxClients,
    maxSecurityGuards,
    maxPostSites,
    maxBackOfficeUsers,

    dashboard: true,
    activity: true,
    clients: true,
    securityTeam: true,
    timeClock: true,
    reportingDays: -1,
    gpsTrackingDays: -1,
    geofenceDays: -1,
    messenger: true,
    siteTourDays: -1,
    taskDays: -1,
    checklistDays: -1,
    supportLevel: "full",
  };
}

const BASIC_LIMITS = {
  maxClients: 3,
  maxSecurityGuards: 2,
  maxPostSites: 3,
  maxBackOfficeUsers: 2,
};

const ADVANCED_LIMITS = {
  maxClients: 6,
  maxSecurityGuards: 5,
  maxPostSites: 6,
  maxBackOfficeUsers: 5,
};

const PROFESSIONAL_LIMITS = {
  maxClients: -1,
  maxSecurityGuards: -1,
  maxPostSites: -1,
  maxBackOfficeUsers: 10,
};

const PLAN_CONFIG = {
  // "Essential" is treated as the Basic plan for backward compatibility.
  essential_monthly: {
    planName: "Basic",
    billingCycle: "monthly",
    commitmentMonths: 1,
    amount: 5,
    currency: "USD",
    features: fullFeatures(BASIC_LIMITS),
  },

  advanced_monthly: {
    planName: "Advanced",
    billingCycle: "monthly",
    commitmentMonths: 1,
    amount: 8,
    currency: "USD",
    features: fullFeatures(ADVANCED_LIMITS),
  },

  professional_monthly: {
    planName: "Professional",
    billingCycle: "monthly",
    commitmentMonths: 1,
    amount: 10.99,
    currency: "USD",
    features: fullFeatures(PROFESSIONAL_LIMITS),
  },

  essential_yearly: {
    planName: "Basic",
    billingCycle: "yearly",
    commitmentMonths: 12,
    amount: 4.5,
    currency: "USD",
    features: fullFeatures(BASIC_LIMITS),
  },

  advanced_yearly: {
    planName: "Advanced",
    billingCycle: "yearly",
    commitmentMonths: 12,
    amount: 6.8,
    currency: "USD",
    features: fullFeatures(ADVANCED_LIMITS),
  },

  professional_yearly: {
    planName: "Professional",
    billingCycle: "yearly",
    commitmentMonths: 12,
    amount: 8.5,
    currency: "USD",
    features: fullFeatures(PROFESSIONAL_LIMITS),
  },
};

module.exports = {
  PLAN_CONFIG,
  BASIC_LIMITS,
  ADVANCED_LIMITS,
  PROFESSIONAL_LIMITS,
};
