export interface PaymentIntent {
  amount: number; // in cents
  currency: string;
  country: string;
  cardFingerprint: string;
  cardAgeDays?: number;
  subscriptionId?: string;
  customerId: string;
  metadata?: Record<string, string>;
}

export type PaymentStatus = "success" | "failed" | "rejected" | "pending";

export interface PaymentResult {
  status: PaymentStatus;
  chargeId?: string;
  amount: number;
  reason?: string;
  fraudScore?: number;
}
