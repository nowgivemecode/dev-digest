import { z } from 'zod';

/**
 * PR Brief v2 — compact brief with human-readable summary, risk level, and review focus.
 * Distinct from the existing PrBrief (brief.ts) which is the full composed brief.
 *
 * Uses PrBrief* prefix throughout to avoid barrel collision with Risk / PrBrief
 * already exported from contracts/brief.ts.
 */

// ---- Severity enum (extended with 'critical') ----
export const PrBriefSeverity = z.enum(['low', 'medium', 'high', 'critical']);
export type PrBriefSeverity = z.infer<typeof PrBriefSeverity>;

// ---- Individual risk item ----
export const PrBriefRiskSchema = z.object({
  title: z.string(),
  explanation: z.string(),
  severity: PrBriefSeverity,
  file_refs: z.array(z.string()),
});
export type PrBriefRisk = z.infer<typeof PrBriefRiskSchema>;

// ---- Full brief ----
export const PrBriefSchema = z.object({
  what: z.string(),
  why: z.string(),
  risk_level: PrBriefSeverity,
  risks: z.array(PrBriefRiskSchema),
  review_focus: z.array(z.string()),
});
/** Compact PR brief summary (distinct from the composed PrBrief in brief.ts). */
export type PrBriefData = z.infer<typeof PrBriefSchema>;

// ---- Brief + cache metadata ----
export const PrBriefRecordSchema = PrBriefSchema.extend({
  pr_id: z.string(),
  head_sha: z.string(),
  computed_at: z.string(),
});
export type PrBriefRecord = z.infer<typeof PrBriefRecordSchema>;
