import { eq, desc, and } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';

/**
 * Evals data-access. Owns `eval_cases` and `eval_runs` tables.
 * All queries are workspace-scoped for cases; runs are scoped through their case.
 */
export class EvalsRepository {
  constructor(private db: Db) {}

  async insertCase(data: {
    workspaceId: string;
    ownerKind: 'skill' | 'agent';
    ownerId: string;
    name: string;
    inputDiff?: string | null;
    inputFiles?: unknown;
    inputMeta?: unknown;
    expectedOutput: unknown;
    notes?: string | null;
  }): Promise<typeof t.evalCases.$inferSelect> {
    const [row] = await this.db
      .insert(t.evalCases)
      .values({
        workspaceId: data.workspaceId,
        ownerKind: data.ownerKind,
        ownerId: data.ownerId,
        name: data.name,
        inputDiff: data.inputDiff ?? null,
        inputFiles: (data.inputFiles as object | undefined) ?? null,
        inputMeta: (data.inputMeta as object | undefined) ?? null,
        expectedOutput: data.expectedOutput as object,
        notes: data.notes ?? null,
      })
      .returning();
    return row!;
  }

  async findCasesByOwner(
    ownerId: string,
    ownerKind: 'skill' | 'agent',
  ): Promise<typeof t.evalCases.$inferSelect[]> {
    return this.db
      .select()
      .from(t.evalCases)
      .where(
        and(eq(t.evalCases.ownerId, ownerId), eq(t.evalCases.ownerKind, ownerKind)),
      );
  }

  async findCaseById(id: string): Promise<typeof t.evalCases.$inferSelect | undefined> {
    const [row] = await this.db
      .select()
      .from(t.evalCases)
      .where(eq(t.evalCases.id, id));
    return row;
  }

  async updateCase(
    id: string,
    data: Partial<{
      name: string;
      inputDiff: string | null;
      inputFiles: unknown;
      inputMeta: unknown;
      expectedOutput: unknown;
      notes: string | null;
    }>,
  ): Promise<typeof t.evalCases.$inferSelect> {
    const [row] = await this.db
      .update(t.evalCases)
      .set({
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.inputDiff !== undefined ? { inputDiff: data.inputDiff } : {}),
        ...(data.inputFiles !== undefined
          ? { inputFiles: data.inputFiles as object }
          : {}),
        ...(data.inputMeta !== undefined
          ? { inputMeta: data.inputMeta as object }
          : {}),
        ...(data.expectedOutput !== undefined
          ? { expectedOutput: data.expectedOutput as object }
          : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      })
      .where(eq(t.evalCases.id, id))
      .returning();
    return row!;
  }

  async deleteCase(id: string): Promise<void> {
    await this.db.delete(t.evalCases).where(eq(t.evalCases.id, id));
  }

  async insertRun(data: {
    caseId: string;
    actualOutput?: unknown;
    pass?: boolean | null;
    recall?: number | null;
    precision?: number | null;
    citationAccuracy?: number | null;
    durationMs?: number | null;
    costUsd?: number | null;
  }): Promise<typeof t.evalRuns.$inferSelect> {
    const [row] = await this.db
      .insert(t.evalRuns)
      .values({
        caseId: data.caseId,
        actualOutput: (data.actualOutput as object | undefined) ?? null,
        pass: data.pass ?? null,
        recall: data.recall ?? null,
        precision: data.precision ?? null,
        citationAccuracy: data.citationAccuracy ?? null,
        durationMs: data.durationMs ?? null,
        costUsd: data.costUsd ?? null,
      })
      .returning();
    return row!;
  }

  async findRunsByCase(caseId: string): Promise<typeof t.evalRuns.$inferSelect[]> {
    return this.db
      .select()
      .from(t.evalRuns)
      .where(eq(t.evalRuns.caseId, caseId))
      .orderBy(desc(t.evalRuns.ranAt));
  }

  /** Join eval_runs → eval_cases filtered by owner_id = agentId */
  async findRunsByAgent(
    agentId: string,
    limit = 50,
  ): Promise<Array<typeof t.evalRuns.$inferSelect & { case_name?: string }>> {
    const rows = await this.db
      .select({
        id: t.evalRuns.id,
        caseId: t.evalRuns.caseId,
        ranAt: t.evalRuns.ranAt,
        actualOutput: t.evalRuns.actualOutput,
        pass: t.evalRuns.pass,
        recall: t.evalRuns.recall,
        precision: t.evalRuns.precision,
        citationAccuracy: t.evalRuns.citationAccuracy,
        durationMs: t.evalRuns.durationMs,
        costUsd: t.evalRuns.costUsd,
        case_name: t.evalCases.name,
      })
      .from(t.evalRuns)
      .innerJoin(t.evalCases, eq(t.evalRuns.caseId, t.evalCases.id))
      .where(eq(t.evalCases.ownerId, agentId))
      .orderBy(desc(t.evalRuns.ranAt))
      .limit(limit);
    return rows;
  }

  /** Join eval_runs → eval_cases filtered by workspace_id = workspaceId (for dashboard) */
  async findRecentRunsForWorkspace(
    workspaceId: string,
    limit = 20,
  ): Promise<Array<typeof t.evalRuns.$inferSelect & { case_name?: string }>> {
    const rows = await this.db
      .select({
        id: t.evalRuns.id,
        caseId: t.evalRuns.caseId,
        ranAt: t.evalRuns.ranAt,
        actualOutput: t.evalRuns.actualOutput,
        pass: t.evalRuns.pass,
        recall: t.evalRuns.recall,
        precision: t.evalRuns.precision,
        citationAccuracy: t.evalRuns.citationAccuracy,
        durationMs: t.evalRuns.durationMs,
        costUsd: t.evalRuns.costUsd,
        case_name: t.evalCases.name,
      })
      .from(t.evalRuns)
      .innerJoin(t.evalCases, eq(t.evalRuns.caseId, t.evalCases.id))
      .where(eq(t.evalCases.workspaceId, workspaceId))
      .orderBy(desc(t.evalRuns.ranAt))
      .limit(limit);
    return rows;
  }

  /** Return a case only if it belongs to the given owner (ownership check) */
  async findCaseByIdAndOwner(
    caseId: string,
    ownerId: string,
  ): Promise<typeof t.evalCases.$inferSelect | null> {
    const [row] = await this.db
      .select()
      .from(t.evalCases)
      .where(and(eq(t.evalCases.id, caseId), eq(t.evalCases.ownerId, ownerId)));
    return row ?? null;
  }

  /** Fetch all cases + their latest run for each agent in workspace */
  async findDashboardData(
    workspaceId: string,
  ): Promise<
    Array<typeof t.evalCases.$inferSelect & { latestRun?: typeof t.evalRuns.$inferSelect }>
  > {
    const cases = await this.db
      .select()
      .from(t.evalCases)
      .where(eq(t.evalCases.workspaceId, workspaceId));

    if (cases.length === 0) return [];

    // For each case, fetch latest run
    const results: Array<
      typeof t.evalCases.$inferSelect & { latestRun?: typeof t.evalRuns.$inferSelect }
    > = [];

    for (const evalCase of cases) {
      const [latestRun] = await this.db
        .select()
        .from(t.evalRuns)
        .where(eq(t.evalRuns.caseId, evalCase.id))
        .orderBy(desc(t.evalRuns.ranAt))
        .limit(1);

      results.push({ ...evalCase, latestRun });
    }

    return results;
  }
}
