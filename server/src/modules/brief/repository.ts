import { and, eq, sql } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { PrBriefData, PrBriefRecord } from '../../vendor/shared/index.js';

/**
 * Map a raw DB row from `pr_brief` to the `PrBriefRecord` contract shape.
 */
function toRecord(row: typeof t.prBrief.$inferSelect): PrBriefRecord {
  const data = row.json as PrBriefData;
  return {
    ...data,
    pr_id: row.prId as unknown as number, // stored as UUID string; cast to satisfy contract
    head_sha: row.headSha,
    computed_at: row.computedAt.toISOString(),
  };
}

/**
 * Look up a cached brief for the given PR + head SHA combination.
 * Returns undefined when no record exists (cache miss).
 */
export async function getBrief(
  db: Db,
  prId: string,
  headSha: string,
): Promise<PrBriefRecord | undefined> {
  const [row] = await db
    .select()
    .from(t.prBrief)
    .where(and(eq(t.prBrief.prId, prId), eq(t.prBrief.headSha, headSha)));

  if (!row) return undefined;
  return toRecord(row);
}

/**
 * Insert or update a brief for the given PR + head SHA combination.
 * On conflict (pr_id, head_sha) the json and computed_at are refreshed.
 * Returns the upserted row mapped to `PrBriefRecord`.
 */
export async function upsertBrief(
  db: Db,
  prId: string,
  headSha: string,
  brief: PrBriefData,
): Promise<PrBriefRecord> {
  const rows = await db
    .insert(t.prBrief)
    .values({
      prId,
      headSha,
      json: brief,
    })
    .onConflictDoUpdate({
      target: [t.prBrief.prId, t.prBrief.headSha],
      set: {
        json: brief,
        computedAt: sql`now()`,
      },
    })
    .returning();

  const row = rows[0];
  if (!row) throw new Error('upsertBrief: expected a returned row but got none');
  return toRecord(row);
}
