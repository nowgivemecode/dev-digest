/**
 * repository.ts — BlastRepository: data access for the blast module.
 *
 * Onion layer: infrastructure — owns all DB queries for blast radius.
 * Receives `db: Db` from the service (no direct singleton import).
 */
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import { eq, and, inArray, ne, desc } from 'drizzle-orm';

export interface PriorPr {
  id: string;
  number: number;
  title: string;
  openedAt: string | null;
  status: string;
}

export class BlastRepository {
  constructor(private readonly db: Db) {}

  /**
   * Resolve the pull request row and its repo row, scoped by workspace.
   */
  async resolvePrAndRepo(
    prId: string,
    workspaceId: string,
  ): Promise<{
    pr: typeof t.pullRequests.$inferSelect | null;
    repo: typeof t.repos.$inferSelect | null;
  }> {
    const [pr] = await this.db
      .select()
      .from(t.pullRequests)
      .where(
        and(
          eq(t.pullRequests.id, prId),
          eq(t.pullRequests.workspaceId, workspaceId),
        ),
      )
      .limit(1);

    if (!pr) {
      return { pr: null, repo: null };
    }

    const [repo] = await this.db
      .select()
      .from(t.repos)
      .where(eq(t.repos.id, pr.repoId))
      .limit(1);

    return { pr, repo: repo ?? null };
  }

  /**
   * Return the distinct file paths changed in a given PR.
   */
  async getChangedFilePaths(prId: string): Promise<string[]> {
    const rows = await this.db
      .select({ path: t.prFiles.path })
      .from(t.prFiles)
      .where(eq(t.prFiles.prId, prId));

    return rows.map((r) => r.path);
  }

  /**
   * Find distinct PRs (other than the given one) that touched at least one of
   * the provided file paths in the same repo. Ordered by openedAt desc.
   */
  async findPriorPrsTouchingSameFiles(
    repoId: string,
    excludePrId: string,
    paths: string[],
    limit = 5,
  ): Promise<PriorPr[]> {
    if (paths.length === 0) return [];

    const rows = await this.db
      .selectDistinct({
        id: t.pullRequests.id,
        number: t.pullRequests.number,
        title: t.pullRequests.title,
        openedAt: t.pullRequests.openedAt,
        status: t.pullRequests.status,
      })
      .from(t.pullRequests)
      .innerJoin(t.prFiles, eq(t.prFiles.prId, t.pullRequests.id))
      .where(
        and(
          eq(t.pullRequests.repoId, repoId),
          ne(t.pullRequests.id, excludePrId),
          inArray(t.prFiles.path, paths),
        ),
      )
      .orderBy(desc(t.pullRequests.openedAt))
      .limit(limit);

    return rows.map((r) => ({
      id: r.id,
      number: r.number,
      title: r.title,
      openedAt: r.openedAt ? r.openedAt.toISOString() : null,
      status: r.status,
    }));
  }
}
