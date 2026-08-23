export const paymentConfig = {
  stripe: {
    apiVersion: "2024-06-20",
    maxRetries: 3,
    timeoutMs: 10_000,
    webhookToleranceSecs: 300,
  },
  fraud: {
    blockThreshold: 0.85,
    reviewThreshold: 0.6,
    velocityWindowMs: 60_000,
    velocityLimit: 5,
  },
  tax: {
    euRate: 0.20,
    usRate: 0.08,
    enabledRegions: ["EU", "US", "CA"],
  },
};
