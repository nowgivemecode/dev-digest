import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { DevDigestClient } from '../http/client.js';
import type { resolvePullId } from '../core/resolve.js';
import { pickReview, shapeFindings } from '../core/findings.js';
import { toolOk, toolError } from '../format.js';

export function registerGetFindings(server: McpServer, client: DevDigestClient, deps: { resolvePullId: typeof resolvePullId }): void {
  server.registerTool('devdigest_get_findings', {
    description: 'Get findings from the latest completed review run for a PR.',
    inputSchema: {
      repo: z.string().describe("Repository name."),
      pr: z.number().int().describe("PR number."),
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, async ({ repo, pr }) => {
    try {
      const r = await deps.resolvePullId(client, repo, pr);
      if ('error' in r) return toolError(r.error);
      const runs = await client.listRuns(r.pullId);
      const run = pickReview(runs);
      if (!run) return toolError('No completed review run found for this PR.');
      const trace = await client.getRunTrace(run.id) as Parameters<typeof shapeFindings>[0];
      return toolOk(shapeFindings(trace));
    } catch (err) {
      return toolError(String(err));
    }
  });
}
