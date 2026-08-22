import type { Container } from '../../platform/container.js';
import type { PrIntentResult } from '@devdigest/shared';
import type { RunLogger } from '../../platform/run-logger.js';
import { resolveFeatureModel } from '../../platform/feature-models.js';
import { assembleIntentPrompt, buildIntentPromptLog } from './prompt.js';
import { upsertPrIntent, getPrIntentScoped } from './repository.js';
import type { PullRow } from '../../db/rows.js';
import { PrIntentResult as PrIntentResultSchema } from '@devdigest/shared';

/** Regex to extract a GitHub issue URL from the PR body. */
const GITHUB_ISSUE_RE = /https?:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+/;

/**
 * Classify the intent of a pull request using an LLM.
 *
 * Best-effort — NEVER throws to the caller. On any error logs and returns null
 * so that a failing classifier never blocks a review run.
 */
export async function classifyIntent(
  container: Container,
  workspaceId: string,
  pull: PullRow,
  prFiles: Array<{ path: string; patch: string | null }>,
  runLog: RunLogger,
): Promise<PrIntentResult | null> {
  try {
    const { provider, model } = await resolveFeatureModel(container, workspaceId, 'review_intent');

    // Attempt to fetch a linked ticket from the PR body via the GitHub adapter.
    const issueMatch = pull.body ? GITHUB_ISSUE_RE.exec(pull.body) : null;
    const linkedContext = issueMatch
      ? await (await container.github()).fetchIssueBodyByUrl(issueMatch[0])
      : null;

    const files = prFiles.map(f => ({ path: f.path, patch: f.patch }));
    const assembled = assembleIntentPrompt(
      { title: pull.title, body: pull.body ?? null },
      files,
      linkedContext,
    );
    const { system, user } = assembled;

    runLog.info('prompt_assembled', buildIntentPromptLog(
      { title: pull.title, body: pull.body ?? null },
      files,
      linkedContext,
      assembled,
      { correlationId: pull.id, model, provider },
    ));

    const llm = await container.llm(provider);
    const res = await llm.completeStructured<PrIntentResult>({
      model,
      schema: PrIntentResultSchema,
      schemaName: 'PrIntentResult',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });

    const result = res.data;

    await upsertPrIntent(container.db, pull.id, result);

    runLog.info('Intent classified', {
      event: 'intent_classified',
      prId: pull.id,
      model,
      provider,
      confidence: result.confidence,
      in_scope_count: result.in_scope.length,
      out_of_scope_count: result.out_of_scope.length,
      risk_areas_count: result.risk_areas.length,
      sources: result.sources,
      linked_context_fetched: linkedContext !== null,
    });

    return result;
  } catch (err) {
    runLog.info(`Intent classification failed (non-blocking): ${(err as Error).message}`);
    return null;
  }
}

/**
 * Retrieve the stored intent result for a PR, scoped to the given workspace.
 * Returns null when no intent has been classified yet.
 */
export async function getIntent(
  container: Container,
  workspaceId: string,
  prId: string,
): Promise<PrIntentResult | null> {
  return getPrIntentScoped(container.db, workspaceId, prId);
}
