/**
 * service.ts — BriefService: orchestrates PR brief computation.
 *
 * Onion layer: application layer — orchestrates repo + adapters; no SQL here.
 * - Loads PR via ReviewRepository (workspace-scoped).
 * - Checks cache via getBrief; on miss calls computeWithPull.
 * - Loads intent via IntentService.getOrCompute.
 * - Loads blast radius via container.repoIntel.getBlastRadius.
 * - Loads PR files (stripped of patch) via ReviewRepository.getPrFiles.
 * - Resolves linked issue from PR body via container.github (best-effort).
 * - Resolves feature model via resolveFeatureModel (risk_brief slot).
 * - Builds prompt + calls LLM via buildBriefPrompt + callBriefLlm.
 * - Upserts result via upsertBrief; returns PrBriefRecord.
 *
 * Error handling:
 *   ERR-01: intent unavailable → computed inline by IntentService
 *   ERR-02: blast empty/degraded → empty arrays passed to prompt
 *   ERR-03: linked issue unavailable → null passed to prompt
 *   ERR-04: LLM error → ExternalServiceError(502, 'brief_llm_error')
 */
import type { Container } from '../../platform/container.js';
import type { PrBriefRecord } from '../../vendor/shared/index.js';
import { NotFoundError, AppError } from '../../platform/errors.js';
import { ReviewRepository } from '../reviews/repository.js';
import type { PullRow } from '../reviews/repository.js';
import { IntentService } from '../intent/service.js';
import { resolveFeatureModel } from '../settings/feature-models.js';
import { getBrief, upsertBrief } from './repository.js';
import { buildBriefPrompt, callBriefLlm } from './classifier.js';
import type { Logger } from '../reviews/run-executor.js';
import { parseReferences } from '../intent/references.js';

export class BriefService {
  private repo: ReviewRepository;
  private logger: Logger | undefined;

  constructor(
    private container: Container,
    logger?: Logger,
  ) {
    this.repo = new ReviewRepository(container.db);
    this.logger = logger;
  }

  /**
   * Return stored brief if the head SHA matches (cache-hit: no LLM call).
   * Compute + store on miss.
   */
  async getOrCompute(workspaceId: string, prId: string): Promise<PrBriefRecord> {
    // 1. Load PR; 404 if missing.
    const pull = await this.repo.getPull(workspaceId, prId);
    if (!pull) throw new NotFoundError(`Pull request not found: ${prId}`);

    // 2. Snapshot headSha.
    const headSha = pull.headSha;

    // 3. Check cache.
    const cached = await getBrief(this.container.db, prId, headSha);
    if (cached) return cached;

    // 4. Cache miss — compute.
    return this.computeWithPull(workspaceId, pull, headSha);
  }

  /**
   * Always re-computes + upserts, even if a stored brief exists.
   */
  async recompute(workspaceId: string, prId: string): Promise<PrBriefRecord> {
    // 1. Load PR; 404 if missing.
    const pull = await this.repo.getPull(workspaceId, prId);
    if (!pull) throw new NotFoundError(`Pull request not found: ${prId}`);

    // 2. Snapshot headSha.
    const headSha = pull.headSha;

    // 3. Always compute.
    return this.computeWithPull(workspaceId, pull, headSha);
  }

  // ---- private orchestration ------------------------------------------------

  private async computeWithPull(
    workspaceId: string,
    pull: PullRow,
    headSha: string,
  ): Promise<PrBriefRecord> {
    const prId = pull.id;

    // Step 1 (ERR-01): Load intent — computed inline by IntentService if missing.
    const intentService = new IntentService(this.container, this.logger);
    const intentRecord = await intentService.getOrCompute(workspaceId, prId);
    const intent = {
      intent: (intentRecord as { intent?: string }).intent ?? '',
      inScope: (intentRecord as { inScope?: string[] }).inScope ?? [],
      outOfScope: (intentRecord as { outOfScope?: string[] }).outOfScope ?? [],
    };

    // Step 2 (ERR-02): Load blast radius — empty arrays if degraded/missing.
    const prFiles = await this.repo.getPrFiles(prId);
    const filePaths = prFiles.map((f) => f.path);

    let blast: { changedSymbols: string[]; callers: string[]; impactedEndpoints: string[] } = {
      changedSymbols: [],
      callers: [],
      impactedEndpoints: [],
    };
    try {
      const blastResult = await this.container.repoIntel.getBlastRadius(pull.repoId, filePaths);
      if (!blastResult.degraded && blastResult.changedSymbols.length > 0) {
        blast = {
          changedSymbols: blastResult.changedSymbols.map((s) => `${s.file}:${s.name}`),
          callers: blastResult.callers.map((c) => `${c.file}:${c.symbol}`),
          impactedEndpoints: blastResult.impactedEndpoints,
        };
      }
    } catch {
      // ERR-02: degraded → keep empty arrays.
      this.logger?.warn({ prId }, 'brief/service: blast radius unavailable, using empty arrays');
    }

    // Step 3: Strip patch field before passing files to classifier.
    const filesForPrompt = prFiles.map(({ patch: _, ...f }) => ({
      path: f.path,
      additions: f.additions,
      deletions: f.deletions,
    }));

    // Step 4 (ERR-03): Resolve linked issue from PR body — null if unavailable.
    let linkedIssue: { title: string; body: string | null } | null = null;
    try {
      const github = await this.container.github().catch(() => null);
      if (github && pull.body) {
        const repoRow = await this.repo.getRepo(pull.repoId);
        if (repoRow) {
          const repoRef = { owner: repoRow.owner, name: repoRow.name };
          const parsedRefs = parseReferences(pull.body, repoRef);
          const firstGithubRef = parsedRefs.find((r) => r.kind === 'github');
          if (firstGithubRef?.issueNumber != null) {
            const n = firstGithubRef.issueNumber;
            const targetRef =
              firstGithubRef.targetOwner && firstGithubRef.targetRepo
                ? { owner: firstGithubRef.targetOwner, name: firstGithubRef.targetRepo }
                : repoRef;
            try {
              const fetched = await github.getIssue(targetRef, n);
              linkedIssue = { title: fetched.title, body: fetched.body ?? null };
            } catch {
              try {
                const pr = await github.getPullRequest(targetRef, n);
                linkedIssue = { title: pr.title, body: pr.body ?? null };
              } catch {
                // ERR-03: best-effort → skip.
              }
            }
          }
        }
      }
    } catch {
      // ERR-03: best-effort → null.
      this.logger?.warn({ prId }, 'brief/service: linked issue resolution failed, using null');
    }

    // Step 5: Resolve feature model.
    const { provider, model } = await resolveFeatureModel(
      this.container,
      workspaceId,
      'risk_brief',
    );
    const llm = await this.container.llm(provider);

    // Step 6 (ERR-04): Build prompt + call LLM.
    const { messages, allowedRefs } = buildBriefPrompt({
      pr: {
        id: prId,
        title: pull.title,
        body: pull.body ?? null,
        additions: pull.additions,
        deletions: pull.deletions,
        filesCount: pull.filesCount,
        headSha,
      },
      files: filesForPrompt,
      intent,
      blast,
      linkedIssue,
    });

    let brief;
    try {
      brief = await callBriefLlm(llm, model, messages, allowedRefs, this.logger);
    } catch (err) {
      // ERR-04: LLM error → 502 with code brief_llm_error.
      throw new AppError(
        'brief_llm_error',
        `LLM call failed for PR ${prId}`,
        502,
        err instanceof Error ? err.message : String(err),
      );
    }

    // Step 7: Upsert and return.
    return upsertBrief(this.container.db, prId, headSha, brief);
  }
}
