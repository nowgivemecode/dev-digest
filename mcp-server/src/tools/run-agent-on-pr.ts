import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { DevDigestClient } from '../http/client.js';
import type { resolvePullId } from '../core/resolve.js';
import { runReviewAndWait } from '../core/run-review.js';
import { toolOk, toolError } from '../format.js';

export function registerRunAgentOnPr(server: McpServer, client: DevDigestClient, deps: { resolvePullId: typeof resolvePullId }): void {
  server.registerTool('devdigest_run_agent_on_pr', {
    description: 'Run a DevDigest review agent on a PR and wait for results (up to 120s).',
    inputSchema: {
      repo: z.string().describe("Repository name."),
      pr: z.number().int().describe("PR number."),
      agent: z.string().describe("Agent name or ID."),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async ({ repo, pr, agent }) => {
    try {
      const r = await deps.resolvePullId(client, repo, pr);
      if ('error' in r) return toolError(r.error);
      return toolOk(await runReviewAndWait(client, r.pullId, agent));
    } catch (err) {
      return toolError(String(err));
    }
  });
}
