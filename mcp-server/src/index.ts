import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { config } from './config.js';
import { log } from './log.js';
import { createClient } from './http/client.js';
import { registerListAgents } from './tools/list-agents.js';
import { registerGetConventions } from './tools/get-conventions.js';
import { registerGetFindings } from './tools/get-findings.js';
import { registerRunAgentOnPr } from './tools/run-agent-on-pr.js';
import { registerGetBlastRadius } from './tools/get-blast-radius.js';
import { resolveRepoId, resolvePullId } from './core/resolve.js';

async function main(): Promise<void> {
  log.info('DevDigest MCP server starting', { apiUrl: config.apiUrl });

  const server = new McpServer({ name: 'devdigest', version: '0.1.0' });
  const client = createClient();

  registerListAgents(server, client);
  registerGetConventions(server, client, { resolveRepoId });
  registerGetFindings(server, client, { resolvePullId });
  registerRunAgentOnPr(server, client, { resolvePullId });
  registerGetBlastRadius(server, client, { resolvePullId });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.info('MCP server connected via stdio');
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`);
  process.exit(1);
});
