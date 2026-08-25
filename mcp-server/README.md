# @devdigest/mcp-server

Model Context Protocol (MCP) server for DevDigest. Exposes DevDigest PR review capabilities as MCP tools so that AI assistants (Claude, Cursor, etc.) can review pull requests, inspect findings, and query repo conventions directly from the chat interface.

## What it does

The MCP server wraps the DevDigest REST API (`http://localhost:3001` by default) and exposes five tools:

| Tool | Description |
|---|---|
| `devdigest_list_agents` | List all configured reviewer agents |
| `devdigest_get_conventions` | Fetch coding conventions for a repository |
| `devdigest_get_findings` | Get findings from the latest completed review run for a PR |
| `devdigest_run_agent_on_pr` | Trigger a review agent on a PR and poll until done (up to 120s) |
| `devdigest_get_blast_radius` | Map a PR's blast radius: changed symbols, callers, impacted endpoints, and history |

## How to start

```sh
# From the repo root
npx tsx mcp-server/src/index.ts

# Or from the mcp-server directory
npm start
```

Set `DEVDIGEST_API_URL` to override the default API base URL:

```sh
DEVDIGEST_API_URL=http://my-server:3001 npx tsx mcp-server/src/index.ts
```

The server communicates over **stdio** (JSON-RPC). All diagnostic output goes to stderr; stdout is reserved for the JSON-RPC channel.

## Verify with MCP Inspector

```sh
npx @modelcontextprotocol/inspector npx tsx mcp-server/src/index.ts
```

Open the URL printed by the inspector. You should see five tools listed under the `devdigest` server.

## Requirements

- Node.js 18+
- DevDigest API server running at `http://localhost:3001` (or `DEVDIGEST_API_URL`)
- `npm install` inside `mcp-server/` before first use

## Claude Code / Cursor integration

A `.mcp.json` file at the repo root registers this server automatically when you open the project in Claude Code or Cursor with MCP support enabled.
