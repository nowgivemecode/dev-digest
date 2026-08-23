import type { PaymentResult } from "./types";

export type BillingInterval = "monthly" | "annual";

interface Subscription {
  id: string;
  customerId: string;
  planId: string;
  interval: BillingInterval;
  nextBillingDate: Date;
  status: "active" | "past_due" | "cancelled";
}

export class SubscriptionManager {
  async charge(subscriptionId: string, amount: number): Promise<PaymentResult> {
    const sub = await this.fetchSubscription(subscriptionId);

    if (sub.status === "cancelled") {
      return { status: "failed", reason: "subscription_cancelled", amount };
    }

    if (sub.status === "past_due") {
      // Attempt recovery: charge with retry flag
      return await this.retryCharge(sub, amount);
    }

    return await this.issueInvoice(sub, amount);
  }

  async cancelSubscription(subscriptionId: string, immediate = false): Promise<void> {
    const sub = await this.fetchSubscription(subscriptionId);
    if (sub.status === "cancelled") return;

    if (immediate) {
      await this.updateStatus(subscriptionId, "cancelled");
    } else {
      // Schedule cancellation at period end — don't refund current period
      await this.scheduleEndOfPeriodCancellation(sub);
    }
  }

  async upgradeInterval(subscriptionId: string, to: BillingInterval): Promise<void> {
    const sub = await this.fetchSubscription(subscriptionId);
    if (sub.interval === to) return;

    const prorationAmount = this.calculateProration(sub, to);
    if (prorationAmount > 0) {
      await this.issueProrationCredit(sub.customerId, prorationAmount);
    }
    await this.updateInterval(subscriptionId, to);
  }

  private calculateProration(sub: Subscription, newInterval: BillingInterval): number {
    const now = Date.now();
    const periodEnd = sub.nextBillingDate.getTime();
    const remaining = Math.max(periodEnd - now, 0);
    const periodMs = sub.interval === "monthly" ? 30 * 86400_000 : 365 * 86400_000;
    const fraction = remaining / periodMs;
    const monthlyRate = newInterval === "annual" ? 0.8 : 1.0; // annual discount
    return Math.round(fraction * monthlyRate * 100);
  }

  private async fetchSubscription(_id: string): Promise<Subscription> {
    // Stub — real impl hits Stripe API
    return {
      id: _id,
      customerId: "cus_stub",
      planId: "plan_pro",
      interval: "monthly",
      nextBillingDate: new Date(Date.now() + 15 * 86400_000),
      status: "active",
    };
  }

  private async retryCharge(_sub: Subscription, amount: number): Promise<PaymentResult> {
    return { status: "success", chargeId: "ch_retry_stub", amount };
  }

  private async issueInvoice(_sub: Subscription, amount: number): Promise<PaymentResult> {
    return { status: "success", chargeId: "ch_invoice_stub", amount };
  }

  private async updateStatus(_id: string, _status: Subscription["status"]): Promise<void> {}
  private async scheduleEndOfPeriodCancellation(_sub: Subscription): Promise<void> {}
  private async issueProrationCredit(_customerId: string, _amount: number): Promise<void> {}
  private async updateInterval(_id: string, _interval: BillingInterval): Promise<void> {}
}
