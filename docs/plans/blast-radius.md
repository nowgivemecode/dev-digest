# Implementation Plan: Blast Radius + MCP Server (Lesson 6 HW)

## Overview
Build the Blast Radius feature end-to-end: a server module that reads the repo-intel index
and exposes `GET /pulls/:id/blast`, a `BlastRadiusCard` UI on the PR Overview tab, and a full
`mcp-server/` stdio package with 5 tools (including `devdigest_get_blast_radius`).

No model is needed for the core analysis — all facts come from `container.repoIntel`
(the existing repo-intel index). The optional LLM summary (one call max) is explicitly
out of scope for the parallel implementation phase; it can be added separately.

## Execution mode
**multi-agent (parallel)** — 1 blocking foundation task → 2 parallel tasks. Max 2 concurrent
implementers. Shape: **T1 (server blast module) → [T2a ∥ T2b]**.

## Requirements (from HW spec)

- R1: `GET /pulls/:id/blast` returns `BlastRadiusResult` — changed symbols, callers (≤20 per
  symbol, sorted by file rank, declaration file excluded), impacted HTTP endpoints (reverse
  import graph, max 2 hops), prior PRs touching same files.
- R2: `degraded: true` + `reason` when repo-intel index is incomplete or no changed files;
  never mask missing data with an empty array.
- R3: Server does NOT re-parse/re-build AST on request — reads index only.
- R4: `BlastRadiusCard` on the PR Overview tab (side-by-side with IntentCard), with
  `SummaryBar` (symbol/caller/endpoint counts), `SymbolList`, `PriorPrsAccordion`,
  optional graph lightbox.
- R5: Every `file:line` link is clickable and navigates to the correct line in the
  correct file. Use `githubFileUrl(repo, file, line)` helper.
- R6: Empty state UI when `blastRadius` is undefined; degraded state UI when
  `blastRadius.degraded === true`.
- R7: `devdigest_get_blast_radius` MCP tool — calls `GET /pulls/:id/blast` via HTTP client,
  resolves (repo, pr#) → pullId via `resolvePullId`, returns concise structured result.
  Returns `degraded: true` with reason when index is partial; never throws.
- R8: Full `mcp-server/` stdio package — exactly 5 tools (`list_agents`, `run_agent_on_pr`,
  `get_findings`, `get_conventions`, `get_blast_radius`), registered via root `.mcp.json`,
  logs to stderr only, no hardcoded URLs.

## Affected modules & contracts

- **`server/src/modules/blast/`** (NEW) — 4 files: `repository.ts`, `service.ts`,
  `routes.ts`, `index.ts`. Registered in `server/src/modules/index.ts`.
- **`client/src/lib/hooks/pulls.ts`** — add `useBlastRadius(prId)` hook.
- **`client/src/app/repos/[repoId]/pulls/[number]/_components/BlastRadiusCard/`** (NEW)
  — 7 component files + `helpers.ts` + `index.ts`.
- **`client/src/app/repos/[repoId]/pulls/[number]/_components/OverviewTab/OverviewTab.tsx`**
  — import and render `BlastRadiusCard` beside `IntentCard`.
- **`mcp-server/`** (NEW package) — full stdio MCP server.
- **Root `.mcp.json`** (NEW) — project-scoped MCP registration.
- **Contracts:** none added. `BlastRadiusResult` already exists in `@devdigest/shared`.

## Phased tasks

### Phase 1 — Blast server module (sequential, blocks Phase 2)

- **T1 — blast server module**
  - **Action:**
    1. Create `server/src/modules/blast/repository.ts` — class `BlastRepository(db: Db)` with:
       - `resolvePrAndRepo(prId, workspaceId)` — join pullRequests + repos.
       - `getChangedFilePaths(prId)` — select path from prFiles where prId.
       - `findPriorPrsTouchingSameFiles(repoId, excludePrId, paths, limit=5)` — selectDistinct
         pullRequests joined with prFiles where path in changed paths, ordered by openedAt desc.
    2. Create `server/src/modules/blast/service.ts` — class `BlastService(container)`:
       - `getForPr(prId, workspaceId): Promise<BlastRadiusResult>` — resolves PR+repo (throw
         NotFoundError if missing), gets changed file paths, calls
         `container.repoIntel.getBlastRadius(repo.id, changedFiles)`, fetches prior PRs,
         merges into `BlastRadiusResult`. If `changedFiles.length === 0` return
         `{ changedSymbols: [], callers: [], impactedEndpoints: [], degraded: true, reason: "no_data" }`.
    3. Create `server/src/modules/blast/routes.ts` — register
       `GET /pulls/:id/blast` (schema: IdParams) → `service.getForPr(req.params.id, workspaceId)`.
    4. Create `server/src/modules/blast/index.ts` — `export { default } from "./routes.js"`.
    5. In `server/src/modules/index.ts` — add `import blast from "./blast/routes.js"` and
       register `blast` in the plugin list (follow the existing pattern).
    6. Run `cd server && pnpm tsc --noEmit` and fix all TypeScript errors.
  - **Type:** backend-only
  - **Skills:** fastify-best-practices, drizzle-orm-patterns, onion-architecture, typescript-expert
  - **Owned paths:** `server/src/modules/blast/`, `server/src/modules/index.ts`
  - **Depends-on:** —
  - **Acceptance:**
    - `ls server/src/modules/blast/` lists `index.ts repository.ts routes.ts service.ts`.
    - `grep "blast" server/src/modules/index.ts` shows import + registration.
    - `cd server && pnpm tsc --noEmit` exits 0.

---

### Phase 2 — Parallel wave (run T2a and T2b simultaneously)

- **T2a — BlastRadiusCard UI**
  - **Action:**
    1. Add `useBlastRadius(prId: string | null | undefined)` to
       `client/src/lib/hooks/pulls.ts` — `useQuery<BlastRadiusResult>` hitting
       `/pulls/${prId}/blast`, enabled when prId is non-null.
    2. Create `client/src/app/repos/[repoId]/pulls/[number]/_components/BlastRadiusCard/`:
       - `BlastRadiusCard.tsx` — renders loading skeleton, empty state (no data), degraded
         banner, or full card. Uses `SummaryBar`, `SymbolList`, `PriorPrsAccordion`,
         optional `BlastGraphLightbox`.
       - `SummaryBar.tsx` — counts row: symbols, callers, endpoints, cron jobs (if any).
       - `SymbolList.tsx` — list of changed symbols; each caller link is `file:line` →
         GitHub URL via `githubFileUrl(repoId, path, line)` from
         `client/src/lib/utils/githubUrls.ts`. Max 20 callers per symbol.
       - `PriorPrsAccordion.tsx` — collapsible list of prior PRs that touched the same files.
       - `BlastGraph.tsx` + `BlastGraphLightbox.tsx` — simple dependency graph visualization
         (can be a minimal ASCII or SVG list; fullscreen lightbox via dialog/modal).
       - `helpers.ts` — `buildSymbolRows(blast)` and `buildCronSet(factsByFile)` pure utils.
       - `helpers.test.ts` — unit tests for `buildSymbolRows` and `buildCronSet`.
       - `index.ts` — `export { BlastRadiusCard } from "./BlastRadiusCard"`.
    3. Edit `OverviewTab.tsx` — import `useBlastRadius` and `BlastRadiusCard`, render
       `BlastRadiusCard` in the right column beside `IntentCard` (2-column grid layout,
       wrapped in `ErrorBoundary`).
    4. Add i18n keys to `client/messages/en/prReview.json` under `blastRadius`:
       `title`, `loadingTitle`, `emptyTitle`, `emptyBody`, `degradedBanner`, `error`.
    5. Run `cd client && pnpm tsc --noEmit` and fix all TypeScript errors.
  - **Type:** frontend-only
  - **Skills:** react-best-practices, next-best-practices, frontend-architecture, typescript-expert
  - **Owned paths:**
    `client/src/app/repos/[repoId]/pulls/[number]/_components/BlastRadiusCard/`,
    `client/src/app/repos/[repoId]/pulls/[number]/_components/OverviewTab/OverviewTab.tsx`,
    `client/src/lib/hooks/pulls.ts`,
    `client/messages/en/prReview.json`
  - **Depends-on:** T1
  - **Acceptance:**
    - `ls client/src/app/repos/.../BlastRadiusCard/` lists 9 files.
    - `grep "useBlastRadius" client/src/lib/hooks/pulls.ts` finds the hook.
    - `grep "BlastRadiusCard" client/src/app/.../OverviewTab/OverviewTab.tsx` finds import.
    - `cd client && pnpm tsc --noEmit` exits 0.

- **T2b — MCP Server package**
  - **Action:**
    1. Create `mcp-server/` top-level package with `package.json` (deps:
       `@modelcontextprotocol/sdk`, `zod`, `tsx`; path alias `@devdigest/shared` →
       `../server/src/vendor/shared`), `tsconfig.json`.
    2. Create `mcp-server/src/config.ts` — reads `DEVDIGEST_API_URL` env (default
       `http://localhost:3001`). Never hardcode.
    3. Create `mcp-server/src/log.ts` — logger that writes to **stderr only**.
    4. Create `mcp-server/src/http/client.ts` — `DevDigestClient` class with methods:
       `listAgents()`, `listRepos()`, `listPulls(repoId)`, `triggerReview(pullId, agentId)`,
       `getRunStatus(runId)`, `getRunTrace(runId)`, `getFindings(runId)`,
       `getConventions(repoId)`, `getBlastRadius(pullId)`. All call `localhost:3001` via fetch.
    5. Create `mcp-server/src/core/resolve.ts` — `resolveRepoId(client, repo)` and
       `resolvePullId(client, repo, prNumber)` using list endpoints (no direct lookup exists).
    6. Create `mcp-server/src/core/findings.ts` — `pickReview(runs)`, `shapeFindings(trace)`.
    7. Create `mcp-server/src/core/run-review.ts` — `runReviewAndWait(client, pullId, agentId)`
       triggers review, polls every 2s up to 120s, returns result or `{ status: "running", run_id }`.
    8. Create `mcp-server/src/format.ts` — `toolOk(data)` and `toolError(msg)` helpers.
    9. Create tools (one file each):
       - `tools/list-agents.ts` — `devdigest_list_agents`: GET /agents → list of agents.
       - `tools/get-conventions.ts` — `devdigest_get_conventions`: resolves repoId → GET
         /repos/:id/conventions.
       - `tools/get-findings.ts` — `devdigest_get_findings`: resolves pullId → latest run
         → GET /runs/:id/trace → shaped findings with pagination.
       - `tools/run-agent-on-pr.ts` — `devdigest_run_agent_on_pr`: resolves pullId + agentId
         → trigger → poll → return verdict + findings.
       - `tools/get-blast-radius.ts` — `devdigest_get_blast_radius`: resolves pullId →
         GET /pulls/:id/blast → return result. Never throws; returns degraded info as-is.
    10. Create `mcp-server/src/index.ts` — composition root: build `McpServer`, wire all
        5 tools with injected deps, connect `StdioServerTransport`. NEVER write to stdout.
    11. Create root `.mcp.json`:
        ```json
        {
          "mcpServers": {
            "devdigest": {
              "command": "npx",
              "args": ["tsx", "mcp-server/src/index.ts"],
              "env": { "MCP_TOOL_TIMEOUT": "150000" }
            }
          }
        }
        ```
    12. Create `mcp-server/README.md` — setup steps, tool descriptions, verification with
        MCP Inspector.
    13. Run `cd mcp-server && npx tsc --noEmit` (or equivalent) and fix errors.
  - **Type:** backend-only (new package)
  - **Skills:** typescript-expert, onion-architecture, fastify-best-practices
  - **Owned paths:** `mcp-server/`, `.mcp.json`
  - **Depends-on:** T1
  - **Acceptance:**
    - `ls mcp-server/src/tools/` lists 5 files.
    - `cat .mcp.json` shows valid JSON with `devdigest` server config.
    - `grep "StdioServerTransport" mcp-server/src/index.ts` finds the transport setup.
    - `grep "console.log" mcp-server/src/` returns nothing (stderr only).
    - TypeScript compilation exits 0.

---

## Verification checklist (run after both phases complete)

1. `cd server && pnpm tsc --noEmit` — exits 0.
2. `cd client && pnpm tsc --noEmit` — exits 0.
3. `cd server && pnpm exec vitest run --exclude '**/*.it.test.ts'` — all pass.
4. `cd client && pnpm test` — all pass.
5. Manual smoke (needs running stack):
   - Open demo PR → Overview tab shows BlastRadiusCard beside IntentCard.
   - At least 2 real callers + 1 HTTP endpoint visible on the demo PR that changes a shared helper.
   - Every `file:line` link opens correct GitHub URL.
   - `degraded` banner appears when index is unavailable.
6. MCP smoke: `node --input-type=module <<< "..."` or MCP Inspector call to
   `devdigest_get_blast_radius` returns structured JSON (not an error).

## Red flags — do NOT do these

- Do not re-parse the repo AST on every request (index read only).
- Do not mask `degraded` state with an empty array — always set `degraded: true` + `reason`.
- Do not write to stdout in the MCP server (JSON-RPC channel corruption).
- Do not hardcode `http://localhost:3001` — read from env.
- Do not import `server/src/platform/container.ts` from the MCP server (HTTP-wrap only).
- Do not add LLM calls beyond the optional one-paragraph summary (and that must be a single call).
