import { reviewPullRequest } from '@devdigest/reviewer-core';
import type { EvalCase, EvalOwnerKind } from '@devdigest/shared';
import type {
  EvalCaseInput,
  EvalRunResult,
  EvalRunRecord,
  EvalDashboard,
} from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { parseUnifiedDiff } from '../../adapters/git/diff-parser.js';
import { scoreCase, scoreRun } from './scoring.js';
import type { EvalExpectedOutput, ScoringFinding } from './scoring.js';
import { EvalsRepository } from './repository.js';
import { NotFoundError } from '../../platform/errors.js';

/**
 * Evals service — business logic for eval cases and runs.
 * Owns case CRUD, run execution (via reviewer-core), and dashboard aggregation.
 */
export class EvalsService {
  private repo: EvalsRepository;

  constructor(private container: Container) {
    this.repo = new EvalsRepository(container.db);
  }

  // ---- Case CRUD -------------------------------------------------------

  async createCase(input: EvalCaseInput, workspaceId: string): Promise<EvalCase> {
    const row = await this.repo.insertCase({
      workspaceId,
      ownerKind: input.owner_kind,
      ownerId: input.owner_id,
      name: input.name,
      inputDiff: input.input_diff ?? null,
      inputFiles: input.input_files ?? null,
      inputMeta: input.input_meta ?? null,
      expectedOutput: input.expected_output,
      notes: input.notes ?? null,
    });
    return toEvalCaseDto(row);
  }

  async getCase(id: string): Promise<EvalCase> {
    const row = await this.repo.findCaseById(id);
    if (!row) throw new NotFoundError('Eval case not found');
    return toEvalCaseDto(row);
  }

  /** Fetch a single case, returning null if it doesn't belong to the given agent. */
  async getCaseForAgent(caseId: string, agentId: string): Promise<EvalCase | null> {
    const row = await this.repo.findCaseByIdAndOwner(caseId, agentId);
    if (!row) return null;
    return toEvalCaseDto(row);
  }

  async listCases(agentId: string): Promise<EvalCase[]> {
    const rows = await this.repo.findCasesByOwner(agentId, 'agent');
    return rows.map(toEvalCaseDto);
  }

  async updateCase(id: string, input: EvalCaseInput): Promise<EvalCase> {
    const row = await this.repo.updateCase(id, {
      name: input.name,
      inputDiff: input.input_diff ?? null,
      inputFiles: input.input_files ?? null,
      inputMeta: input.input_meta ?? null,
      expectedOutput: input.expected_output,
      notes: input.notes ?? null,
    });
    return toEvalCaseDto(row);
  }

  async deleteCase(id: string): Promise<void> {
    await this.repo.deleteCase(id);
  }

  /** List runs for a given agent, mapped to EvalRunRecord shape. */
  async listRuns(agentId: string): Promise<import('@devdigest/shared').EvalRunRecord[]> {
    const rows = await this.repo.findRunsByAgent(agentId);
    return rows.map((r) => ({
      id: r.id,
      case_id: r.caseId,
      case_name: r.case_name ?? null,
      ran_at: r.ranAt instanceof Date ? r.ranAt.toISOString() : String(r.ranAt),
      actual_output: r.actualOutput,
      pass: r.pass ?? null,
      recall: r.recall ?? null,
      precision: r.precision ?? null,
      citation_accuracy: r.citationAccuracy ?? null,
      duration_ms: r.durationMs ?? null,
      cost_usd: r.costUsd ?? null,
    }));
  }

  // ---- Run execution ---------------------------------------------------

  async runSingleCase(caseId: string, workspaceId: string): Promise<EvalRunResult> {
    const evalCase = await this.repo.findCaseById(caseId);
    if (!evalCase) throw new NotFoundError('Eval case not found');

    // Resolve the agent that owns this case
    const agent = await this.container.agentsRepo.getById(workspaceId, evalCase.ownerId);
    if (!agent) throw new NotFoundError('Agent not found for eval case');

    const diff = parseUnifiedDiff(evalCase.inputDiff ?? '');
    const providerKey = agent.provider as 'openai' | 'anthropic' | 'openrouter';
    const llmProvider = await this.container.llm(providerKey);
    const startMs = Date.now();

    const outcome = await reviewPullRequest({
      systemPrompt: agent.systemPrompt,
      model: agent.model,
      diff,
      llm: llmProvider,
      strategy: 'single-pass',
      task: `Eval case: ${evalCase.name}`,
      sessionId: `eval:${evalCase.id}`,
      onEvent: () => {},
      checkCancelled: () => {},
    });

    const findings = outcome.review.findings;
    const durationMs = Date.now() - startMs;
    const costUsd = outcome.costUsd ?? null;

    // Convert Finding[] to ScoringFinding[]
    const scoringFindings: ScoringFinding[] = findings.map((f) => ({
      file: f.file,
      startLine: f.start_line ?? null,
      endLine: f.end_line ?? null,
    }));

    const expected = evalCase.expectedOutput as EvalExpectedOutput;
    const pass = scoreCase(expected, scoringFindings);

    // Compute recall/precision from a single trace
    const metrics = scoreRun([
      {
        caseId: evalCase.id,
        caseName: evalCase.name,
        expected,
        findings: scoringFindings,
      },
    ]);

    const runRow = await this.repo.insertRun({
      caseId,
      actualOutput: { findings },
      pass,
      recall: metrics.recall,
      precision: metrics.precision,
      citationAccuracy: metrics.citation_accuracy,
      durationMs,
      costUsd,
    });

    return {
      run_id: runRow.id,
      case_id: caseId,
      result: {
        recall: metrics.recall,
        precision: metrics.precision,
        citation_accuracy: metrics.citation_accuracy,
        traces_passed: metrics.traces_passed,
        traces_total: metrics.traces_total,
        duration_ms: durationMs,
        cost_usd: costUsd,
        per_trace: metrics.per_trace,
      },
    };
  }

  async runAllCases(agentId: string, workspaceId: string): Promise<EvalRunResult[]> {
    const cases = await this.repo.findCasesByOwner(agentId, 'agent');
    const results: EvalRunResult[] = [];

    for (const evalCase of cases) {
      const result = await this.runSingleCase(evalCase.id, workspaceId);
      results.push(result);
    }

    return results;
  }

  // ---- Dashboard -------------------------------------------------------

  async getDashboard(workspaceId: string): Promise<EvalDashboard> {
    const dashboardData = await this.repo.findDashboardData(workspaceId);
    const recentRuns = await this.repo.findRecentRunsForWorkspace(workspaceId, 20);

    const casesTotal = dashboardData.length;

    // Compute current metrics from latest runs
    const latestRuns = dashboardData
      .map((d) => d.latestRun)
      .filter((r): r is NonNullable<typeof r> => r !== undefined);

    const currentRecall =
      latestRuns.length === 0
        ? 1
        : latestRuns.reduce((acc, r) => acc + (r.recall ?? 1), 0) / latestRuns.length;

    const currentPrecision =
      latestRuns.length === 0
        ? 1
        : latestRuns.reduce((acc, r) => acc + (r.precision ?? 1), 0) / latestRuns.length;

    const currentCitationAccuracy =
      latestRuns.length === 0
        ? 1
        : latestRuns.reduce((acc, r) => acc + (r.citationAccuracy ?? 1), 0) /
          latestRuns.length;

    const tracesPassed = latestRuns.filter((r) => r.pass === true).length;
    const tracesTotal = latestRuns.length;

    const totalCostUsd =
      latestRuns.length === 0
        ? null
        : latestRuns.reduce((acc, r) => acc + (r.costUsd ?? 0), 0);

    // Build recent_runs records
    const recentRunRecords: EvalRunRecord[] = recentRuns.map((r) => ({
      id: r.id,
      case_id: r.caseId,
      case_name: r.case_name ?? null,
      ran_at: r.ranAt instanceof Date ? r.ranAt.toISOString() : String(r.ranAt),
      actual_output: r.actualOutput,
      pass: r.pass ?? null,
      recall: r.recall ?? null,
      precision: r.precision ?? null,
      citation_accuracy: r.citationAccuracy ?? null,
      duration_ms: r.durationMs ?? null,
      cost_usd: r.costUsd ?? null,
    }));

    return {
      owner_kind: null,
      owner_id: null,
      cases_total: casesTotal,
      current: {
        recall: currentRecall,
        precision: currentPrecision,
        citation_accuracy: currentCitationAccuracy,
        traces_passed: tracesPassed,
        traces_total: tracesTotal,
        cost_usd: totalCostUsd,
      },
      delta: {
        recall: 0,
        precision: 0,
        citation_accuracy: 0,
      },
      trend: [],
      recent_runs: recentRunRecords,
      alert: null,
    };
  }
}

// ---- DTOs ------------------------------------------------------------------

function toEvalCaseDto(row: {
  id: string;
  ownerKind: string;
  ownerId: string;
  name: string;
  inputDiff: string | null;
  inputFiles: unknown;
  inputMeta: unknown;
  expectedOutput: unknown;
  notes: string | null;
}): EvalCase {
  return {
    id: row.id,
    owner_kind: row.ownerKind as EvalOwnerKind,
    owner_id: row.ownerId,
    name: row.name,
    input_diff: row.inputDiff ?? '',
    input_files: row.inputFiles,
    input_meta: row.inputMeta,
    expected_output: row.expectedOutput,
    notes: row.notes,
  };
}
