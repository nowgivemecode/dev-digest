import type { Db } from '../../db/client.js';
import type { GitHubClient } from '@devdigest/shared';
import {
  upsertPullRequest,
  updatePullDiffStats,
  replacePrFiles,
  replacePrCommits,
  updatePullDetail,
} from './repository.js';

const BACKFILL_LIMIT = 10;

type Repo = { owner: string; name: string; id: string };
type PullRow = { id: string; number: number; additions: number; deletions: number; filesCount: number };

/**
 * Fetch the GitHub PR list for a repo, upsert each into the DB, and return
 * the number of PRs synced.
 */
export async function syncPullsFromGitHub(
  db: Db,
  gh: GitHubClient,
  repo: Repo,
  workspaceId: string,
): Promise<number> {
  const pulls = await gh.listPullRequests({ owner: repo.owner, name: repo.name });
  for (const pr of pulls) {
    await upsertPullRequest(db, {
      workspaceId,
      repoId: repo.id,
      number: pr.number,
      title: pr.title,
      author: pr.author,
      branch: pr.branch,
      base: pr.base,
      headSha: pr.head_sha,
      additions: pr.additions,
      deletions: pr.deletions,
      filesCount: pr.files_count,
      status: pr.status,
      openedAt: pr.opened_at ? new Date(pr.opened_at) : null,
      updatedAt: pr.updated_at ? new Date(pr.updated_at) : null,
    });
  }
  return pulls.length;
}

/**
 * For rows that landed with zeroed diff stats, fetch them from the GitHub
 * detail endpoint and persist. Capped per request. Mutates `rows` in place so
 * the caller's list response sees the updated values without a re-query.
 */
export async function backfillMissingDiffStats(
  db: Db,
  gh: GitHubClient,
  repo: Repo,
  rows: PullRow[],
  log: { warn: (obj: object, msg: string) => void },
): Promise<void> {
  const needStats = rows
    .filter((r) => r.additions === 0 && r.deletions === 0 && r.filesCount === 0)
    .slice(0, BACKFILL_LIMIT);
  for (const r of needStats) {
    try {
      const detail = await gh.getPullRequest({ owner: repo.owner, name: repo.name }, r.number);
      await updatePullDiffStats(db, r.id, {
        additions: detail.additions,
        deletions: detail.deletions,
        filesCount: detail.files_count,
      });
      // Mutate in place — the routes.ts list response depends on this
      r.additions = detail.additions;
      r.deletions = detail.deletions;
      r.filesCount = detail.files_count;
    } catch (err) {
      log.warn({ err, number: r.number }, 'PR diff-stat backfill skipped');
    }
  }
}

/**
 * Refresh a PR's files, commits, and body from GitHub and persist them.
 * Returns the GitHub detail object (already contains all fields needed for
 * `PrDetail`).
 */
export async function refreshPrDetail(
  db: Db,
  gh: GitHubClient,
  repo: Repo,
  pr: { id: string; headSha: string; number: number },
) {
  const detail = await gh.getPullRequest({ owner: repo.owner, name: repo.name }, pr.number);

  await replacePrFiles(
    db,
    pr.id,
    detail.files.map((f) => ({
      path: f.path,
      additions: f.additions,
      deletions: f.deletions,
      patch: f.patch ?? null,
    })),
  );

  await replacePrCommits(
    db,
    pr.id,
    detail.commits.map((c) => ({
      sha: c.sha,
      message: c.message,
      author: c.author,
      committedAt: c.committed_at ? new Date(c.committed_at) : null,
    })),
  );

  await updatePullDetail(db, pr.id, {
    body: detail.body ?? null,
    additions: detail.additions,
    deletions: detail.deletions,
    filesCount: detail.files_count,
  });

  return detail;
}
