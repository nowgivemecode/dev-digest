import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { DevDigestClient } from '../http/client.js';
import type { resolveRepoId } from '../core/resolve.js';
import { toolOk, toolError } from '../format.js';

export function registerGetConventions(server: McpServer, client: DevDigestClient, deps: { resolveRepoId: typeof resolveRepoId }): void {
  server.registerTool('devdigest_get_conventions', {
    description: 'Get coding conventions for a repository.',
    inputSchema: { repo: z.string().describe("Repository name or 'owner/name'.") },
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, async ({ repo }) => {
    try {
      const r = await deps.resolveRepoId(client, repo);
      if ('error' in r) return toolError(r.error);
      return toolOk(await client.getConventions(r.repoId));
    } catch (err) {
      return toolError(String(err));
    }
  });
}
