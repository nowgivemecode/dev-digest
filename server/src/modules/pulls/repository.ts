import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';

// ---- Repos ------------------------------------------------------------------

export async function findRepoByWorkspaceId(
  db: Db,
  workspaceId: string,
  repoId: string,
) {
  const [row] = await db
    .select()
    .from(t.repos)
    .where(and(eq(t.repos.workspaceId, workspaceId), eq(t.repos.id, repoId)));
  return row ?? null;
}

export async function findRepoById(db: Db, repoId: string) {
  const [row] = await db.select().from(t.repos).where(eq(t.repos.id, repoId));
  return row ?? null;
}

// ---- Pull requests ----------------------------------------------------------

export type UpsertPullValues = {
  workspaceId: string;
  repoId: string;
  number: number;
  title: string;
  author: string;
  branch: string;
  base: string;
  headSha: string;
  additions: number;
  deletions: number;
  filesCount: number;
  status: string;
  openedAt: Date | null;
  updatedAt: Date | null;
};

export async function upsertPullRequest(db: Db, values: UpsertPullValues): Promise<void> {
  await db
    .insert(t.pullRequests)
    .values(values)
    .onConflictDoUpdate({
      target: [t.pullRequests.repoId, t.pullRequests.number],
      set: {
        title: values.title,
        headSha: values.headSha,
        status: values.status,
        updatedAt: values.updatedAt,
      },
    });
}

export async function updatePullDiffStats(
  db: Db,
  prId: string,
  stats: { additions: number; deletions: number; filesCount: number },
): Promise<void> {
  await db
    .update(t.pullRequests)
    .set({
      additions: stats.additions,
      deletions: stats.deletions,
      filesCount: stats.filesCount,
    })
    .where(eq(t.pullRequests.id, prId));
}

export async function listPullsByRepoId(db: Db, repoId: string) {
  return db.select().from(t.pullRequests).where(eq(t.pullRequests.repoId, repoId));
}

export async function findPullById(db: Db, workspaceId: string, prId: string) {
  const [row] = await db
    .select()
    .from(t.pullRequests)
    .where(and(eq(t.pullRequests.workspaceId, workspaceId), eq(t.pullRequests.id, prId)));
  return row ?? null;
}

export async function replacePrFiles(
  db: Db,
  prId: string,
  files: { path: string; additions: number; deletions: number; patch: string | null }[],
): Promise<void> {
  await db.delete(t.prFiles).where(eq(t.prFiles.prId, prId));
  if (files.length > 0) {
    await db.insert(t.prFiles).values(
      files.map((f) => ({
        prId,
        path: f.path,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch,
      })),
    );
  }
}

export async function replacePrCommits(
  db: Db,
  prId: string,
  commits: { sha: string; message: string; author: string; committedAt: Date | null }[],
): Promise<void> {
  await db.delete(t.prCommits).where(eq(t.prCommits.prId, prId));
  if (commits.length > 0) {
    await db.insert(t.prCommits).values(
      commits.map((c) => ({
        prId,
        sha: c.sha,
        message: c.message,
        author: c.author,
        committedAt: c.committedAt,
      })),
    );
  }
}

export async function updatePullDetail(
  db: Db,
  prId: string,
  detail: { body: string | null; additions: number; deletions: number; filesCount: number },
): Promise<void> {
  await db
    .update(t.pullRequests)
    .set({
      body: detail.body ?? null,
      additions: detail.additions,
      deletions: detail.deletions,
      filesCount: detail.filesCount,
    })
    .where(eq(t.pullRequests.id, prId));
}

export async function getPrFilesAndCommits(db: Db, prId: string) {
  const [files, commits] = await Promise.all([
    db.select().from(t.prFiles).where(eq(t.prFiles.prId, prId)),
    db.select().from(t.prCommits).where(eq(t.prCommits.prId, prId)),
  ]);
  return { files, commits };
}

// ---- Aggregations for PR list -----------------------------------------------

export type LatestReview = { score: number | null };

export async function latestReviewScoresByPrIds(
  db: Db,
  prIds: string[],
): Promise<Map<string, LatestReview>> {
  const map = new Map<string, LatestReview>();
  if (prIds.length === 0) return map;
  const rows = await db
    .select({ prId: t.reviews.prId, score: t.reviews.score })
    .from(t.reviews)
    .where(and(inArray(t.reviews.prId, prIds), eq(t.reviews.kind, 'review')))
    .orderBy(desc(t.reviews.createdAt));
  // Rows are newest-first → first seen per PR is the latest review.
  for (const rv of rows) {
    if (!map.has(rv.prId)) map.set(rv.prId, { score: rv.score });
  }
  return map;
}

export type LatestRun = {
  cost: number | null;
  critical: number | null;
  warning: number | null;
  suggestion: number | null;
};

export async function latestRunByPrIds(
  db: Db,
  prIds: string[],
): Promise<Map<string, LatestRun>> {
  const map = new Map<string, LatestRun>();
  if (prIds.length === 0) return map;
  const rows = await db
    .select({
      prId: t.agentRuns.prId,
      cost: t.agentRuns.cost,
    })
    .from(t.agentRuns)
    .where(and(inArray(t.agentRuns.prId, prIds), eq(t.agentRuns.status, 'done')))
    .orderBy(desc(t.agentRuns.ranAt));
  for (const r of rows) {
    if (r.prId && !map.has(r.prId)) {
      map.set(r.prId, {
        cost: r.cost != null ? Number(r.cost) : null,
        critical: null,
        warning: null,
        suggestion: null,
      });
    }
  }
  return map;
}
