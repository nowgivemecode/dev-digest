import { eq, and } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import type { PrIntentResult } from '@devdigest/shared';
import * as t from '../../db/schema.js';

/**
 * Upsert the intent classifier result for a PR.
 *
 * Maps `result.summary` to BOTH the `intent` column (backward compat with
 * legacy consumers that read `pr_intent.intent`) and the new `summary` column.
 */
export async function upsertPrIntent(
  db: Db,
  prId: string,
  result: PrIntentResult,
): Promise<void> {
  const now = new Date();
  await db
    .insert(t.prIntent)
    .values({
      prId,
      // Backward compat: `intent` (legacy column) receives the summary value.
      intent: result.summary,
      inScope: result.in_scope,
      outOfScope: result.out_of_scope,
      summary: result.summary,
      riskAreas: result.risk_areas,
      confidence: result.confidence,
      confidenceReason: result.confidence_reason,
      sources: result.sources,
      classifiedAt: now,
    })
    .onConflictDoUpdate({
      target: t.prIntent.prId,
      set: {
        intent: result.summary,
        inScope: result.in_scope,
        outOfScope: result.out_of_scope,
        summary: result.summary,
        riskAreas: result.risk_areas,
        confidence: result.confidence,
        confidenceReason: result.confidence_reason,
        sources: result.sources,
        classifiedAt: now,
      },
    });
}

/**
 * Fetch the stored intent result for a PR.
 * Returns null when no intent has been classified yet.
 *
 * @deprecated Use getPrIntentScoped — this overload has no workspace isolation.
 */
export async function getPrIntent(
  db: Db,
  prId: string,
): Promise<PrIntentResult | null> {
  const [row] = await db
    .select()
    .from(t.prIntent)
    .where(eq(t.prIntent.prId, prId));

  if (!row) return null;

  // If this row was persisted by the old classifier (no summary/risk_areas),
  // degrade gracefully by using `intent` as the summary fallback.
  return {
    summary: row.summary ?? row.intent,
    in_scope: row.inScope ?? [],
    out_of_scope: row.outOfScope ?? [],
    risk_areas: row.riskAreas ?? [],
    confidence: row.confidence ?? 0,
    confidence_reason: row.confidenceReason ?? '',
    sources: row.sources ?? [],
  };
}

/**
 * Fetch the stored intent result for a PR, scoped to a workspace.
 * Uses an inner join with pullRequests to enforce workspace ownership.
 * Returns null when no intent has been classified yet or the PR doesn't
 * belong to the workspace.
 */
export async function getPrIntentScoped(
  db: Db,
  workspaceId: string,
  prId: string,
): Promise<PrIntentResult | null> {
  const [row] = await db
    .select({
      intent: t.prIntent.intent,
      inScope: t.prIntent.inScope,
      outOfScope: t.prIntent.outOfScope,
      summary: t.prIntent.summary,
      riskAreas: t.prIntent.riskAreas,
      confidence: t.prIntent.confidence,
      confidenceReason: t.prIntent.confidenceReason,
      sources: t.prIntent.sources,
    })
    .from(t.prIntent)
    .innerJoin(t.pullRequests, eq(t.prIntent.prId, t.pullRequests.id))
    .where(and(eq(t.prIntent.prId, prId), eq(t.pullRequests.workspaceId, workspaceId)));

  if (!row) return null;

  return {
    summary: row.summary ?? row.intent,
    in_scope: row.inScope ?? [],
    out_of_scope: row.outOfScope ?? [],
    risk_areas: row.riskAreas ?? [],
    confidence: row.confidence ?? 0,
    confidence_reason: row.confidenceReason ?? '',
    sources: row.sources ?? [],
  };
}
