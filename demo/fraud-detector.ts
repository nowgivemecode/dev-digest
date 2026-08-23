import type { PaymentIntent } from "./types";

const HIGH_RISK_COUNTRIES = ["XX", "YY", "ZZ"];
const VELOCITY_WINDOW_MS = 60_000;
const VELOCITY_LIMIT = 5;

interface VelocityEntry {
  ts: number;
  amount: number;
}

export class FraudDetector {
  private velocityCache = new Map<string, VelocityEntry[]>();

  async score(intent: PaymentIntent): Promise<number> {
    let score = 0;

    // Country risk
    if (HIGH_RISK_COUNTRIES.includes(intent.country)) score += 0.4;

    // Amount anomaly: single charge over $10k is a signal
    if (intent.amount > 10_000_00) score += 0.3;

    // Velocity: too many charges from the same card in a rolling window
    const velocityScore = this.checkVelocity(intent.cardFingerprint, intent.amount);
    score += velocityScore;

    // Card freshness: brand-new card on first charge for a large amount
    if (intent.cardAgeDays !== undefined && intent.cardAgeDays < 7 && intent.amount > 500_00) {
      score += 0.2;
    }

    return Math.min(score, 1.0);
  }

  private checkVelocity(fingerprint: string, amount: number): number {
    const now = Date.now();
    const entries = (this.velocityCache.get(fingerprint) ?? []).filter(
      (e) => now - e.ts < VELOCITY_WINDOW_MS,
    );
    entries.push({ ts: now, amount });
    this.velocityCache.set(fingerprint, entries);

    if (entries.length >= VELOCITY_LIMIT) return 0.35;
    if (entries.length >= 3) return 0.15;
    return 0;
  }
}
