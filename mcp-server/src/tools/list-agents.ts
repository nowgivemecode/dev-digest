import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { DevDigestClient } from '../http/client.js';
import { toolOk, toolError } from '../format.js';

export function registerListAgents(server: McpServer, client: DevDigestClient): void {
  server.registerTool('devdigest_list_agents', {
    description: 'List all configured DevDigest reviewer agents.',
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, async () => {
    try {
      return toolOk(await client.listAgents());
    } catch (err) {
      return toolError(String(err));
    }
  });
}
