import type { DevDigestClient } from '../http/client.js';

const POLL_MS = 2000;
const TIMEOUT_MS = 120_000;

export async function runReviewAndWait(
  client: DevDigestClient,
  pullId: string,
  agentId: string,
): Promise<{ verdict: string; run_id: string; findings: unknown } | { status: 'running'; run_id: string }> {
  const { runId } = await client.triggerReview(pullId, { agentId });
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_MS));
    const run = await client.getRunStatus(runId);
    if (run.status === 'done') {
      const trace = await client.getRunTrace(runId) as { verdict?: string; findings?: unknown };
      return { verdict: trace.verdict ?? 'unknown', run_id: runId, findings: trace.findings ?? [] };
    }
    if (run.status === 'failed') {
      return { verdict: 'failed', run_id: runId, findings: run.error ?? 'Run failed' };
    }
  }
  return { status: 'running', run_id: runId };
}
