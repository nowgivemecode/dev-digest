import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { DevDigestClient } from '../http/client.js';
import type { resolvePullId } from '../core/resolve.js';
import { toolOk, toolError } from '../format.js';
import { config } from '../config.js';

export function registerGetBlastRadius(server: McpServer, client: DevDigestClient, deps: { resolvePullId: typeof resolvePullId }): void {
  server.registerTool('devdigest_get_blast_radius', {
    description: "Map a PR's blast radius: changed symbols, callers, impacted HTTP endpoints, and prior PRs touching the same files. Returns degraded:true when the index is unavailable — treat as a known limitation, not a failure.",
    inputSchema: {
      repo: z.string().describe("Repository as 'owner/name' or just name."),
      pr: z.number().int().describe("Pull request number."),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async ({ repo, pr }) => {
    try {
      const r = await deps.resolvePullId(client, repo, pr);
      if ('error' in r) return toolError(r.error);
      return toolOk(await client.getBlastRadius(r.pullId));
    } catch (err) {
      return toolError(`DevDigest API error: ${String(err)}. Ensure the API is running at ${config.apiUrl} (run ./scripts/dev.sh).`);
    }
  });
}
