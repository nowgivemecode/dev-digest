import type { PaymentIntent, PaymentResult } from "./types";
import { FraudDetector } from "./fraud-detector";
import { SubscriptionManager } from "./subscription-manager";

const TAX_RATE_EU = 0.20;
const TAX_RATE_US = 0.08;
const MAX_RETRY_ATTEMPTS = 3;

export class PaymentProcessor {
  private fraudDetector: FraudDetector;
  private subscriptionManager: SubscriptionManager;

  constructor() {
    this.fraudDetector = new FraudDetector();
    this.subscriptionManager = new SubscriptionManager();
  }

  async processPayment(intent: PaymentIntent): Promise<PaymentResult> {
    const fraudScore = await this.fraudDetector.score(intent);
    if (fraudScore > 0.85) {
      return { status: "rejected", reason: "fraud_detected", fraudScore };
    }

    const taxAmount = this.calculateTax(intent.amount, intent.country);
    const totalAmount = intent.amount + taxAmount;

    if (intent.subscriptionId) {
      return await this.subscriptionManager.charge(intent.subscriptionId, totalAmount);
    }

    return await this.chargeOneTime(intent, totalAmount);
  }

  private calculateTax(amount: number, country: string): number {
    if (country.startsWith("EU_")) return amount * TAX_RATE_EU;
    if (country === "US") return amount * TAX_RATE_US;
    return 0;
  }

  private async chargeOneTime(intent: PaymentIntent, total: number): Promise<PaymentResult> {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        const charge = await fetch("/api/stripe/charge", {
          method: "POST",
          body: JSON.stringify({ ...intent, amount: total }),
        });
        if (!charge.ok) throw new Error(`Stripe returned ${charge.status}`);
        const data = await charge.json();
        return { status: "success", chargeId: data.id, amount: total };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < MAX_RETRY_ATTEMPTS) await delay(attempt * 500);
      }
    }
    return { status: "failed", reason: lastError?.message ?? "unknown", amount: total };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
