# Implementation Plan: Eval Pipeline (L06)

## Overview
Build a regression harness for review agents inside the product: eval cases in Postgres,
a one-click "Turn into eval case" button on FindingCard, a POST /agents/:id/eval-runs route
that invokes reviewer-core and scores with pure TypeScript (no LLM), an Evals tab in
AgentEditor, and an Eval Dashboard sidebar page.
Source of truth: `specs/eval-pipeline.md`.

## Execution mode
**multi-agent (parallel)** — Wave 1 is a single blocking foundation agent; Wave 2 fans out
to 4 parallel agents over strictly non-overlapping file paths.

## Requirements

- R1: eval_cases and eval_runs tables exported from schema and migrated
- R2: POST /agents/:id/eval-cases — create eval case; GET list; PUT; DELETE
- R3: POST /agents/:id/eval-runs — run all cases, invoke reviewer-core per case, score in TS
- R4: POST /agents/:id/eval-cases/:caseId/runs — run single case
- R5: GET /agents/:id/eval-runs — list runs (latest first)
- R6: GET /evals/dashboard — aggregate EvalDashboard across all agents in workspace
- R7: Scoring is pure TypeScript — file match + line overlap, no LLM call in metric computation
- R8: recall = passed_must_find / total_must_find; precision = passed_must_not_flag / total_must_not_flag; citation_accuracy = grounded_findings / total_findings
- R9: FindingCard gets "Turn into eval case" button (4th action, flask icon); accepted → must_find, dismissed → must_not_flag
- R10: AgentEditor gains "Evals" tab (after Context, before Stats if Stats exists) with metrics summary + case list + "Run all evals" + "New eval case" + EvalCaseModal
- R11: Eval Dashboard sidebar page at /evals with agent cards + recent runs table
- R12: Agent eval full page at /evals/[agentId] with trend chart (recharts) + runs table + Compare modal
- R13: scoring.test.ts unit tests green (no DB, no LLM)

---

## Wave 1 — Foundation (blocking, single agent)

**Owner:** `server/src/db/schema/index.ts`, migration files, `server/src/modules/evals/scoring.ts`, `server/src/modules/evals/scoring.test.ts`

### Tasks

1. **Export eval tables from schema barrel**
   - File: `server/src/db/schema/index.ts`
   - Add: `export * from './eval.js';` (eval_cases, eval_runs, conformanceChecks, composedReviews)
   - Verify: no duplicate exports conflict with existing schema files

2. **Generate and apply migration**
   - Run: `cd server && pnpm db:generate`
   - Run: `cd server && pnpm db:migrate`
   - Confirm tables exist: `eval_cases`, `eval_runs`, `conformance_checks`, `composed_reviews`

3. **Write scoring module**
   - File: `server/src/modules/evals/scoring.ts`
   - Pure functions, zero imports from DB or LLM adapters
   ```typescript
   // EvalExpectedOutput type
   // linesOverlap(aStart, aEnd, bStart, bEnd, tolerance=5): boolean
   // scoreCase(expected: EvalExpectedOutput, findings: Finding[]): { pass: boolean }
   // scoreRun(cases: EvalCaseWithExpected[], findings: Map<caseId, Finding[]>): EvalRunMetrics
   //   → { recall, precision, citation_accuracy, traces_passed, traces_total, per_trace }
   ```
   - Must not import from `adapters/llm`, `platform/container`, or any async module

4. **Write scoring unit tests**
   - File: `server/src/modules/evals/scoring.test.ts`
   - Test cases (no DB, no vitest mocks of network):
     - must_find: overlapping lines → pass; non-overlapping → fail
     - must_find: same file required; different file → fail
     - must_not_flag: no match → pass; overlap → fail (false positive caught)
     - recall = 2/3 when 2 of 3 must_find pass
     - precision = 1 - 1/2 = 0.5 when 1 of 2 must_not_flag is wrongly flagged
     - citation_accuracy = 2/3 when 1 finding has null startLine
     - edge: zero must_find cases → recall = 1.0
     - edge: zero must_not_flag cases → precision = 1.0

### Done when
- `cd server && pnpm exec vitest run src/modules/evals/scoring.test.ts` exits 0
- `psql $DATABASE_URL -c "\d eval_cases"` returns the table schema

---

## Wave 2 — Feature implementation (4 parallel agents)

All four agents start after Wave 1 completes. File ownership is strictly non-overlapping.

---

### Agent A — Server evals module

**Owned paths (no other agent touches these):**
- `server/src/modules/evals/repository.ts` (new)
- `server/src/modules/evals/service.ts` (new)
- `server/src/modules/evals/routes.ts` (new)
- `server/src/modules/index.ts` (edit — add evals import)

**Context to read first:**
- `server/src/modules/agents/repository.ts` — pattern for Drizzle queries
- `server/src/modules/reviews/service.ts` — how reviewer-core is invoked
- `server/src/db/schema/eval.ts` — table definitions
- `server/src/vendor/shared/contracts/eval-ci.ts` — request/response Zod shapes
- `server/src/vendor/shared/contracts/knowledge.ts` — EvalRun, EvalCase, EvalOwnerKind
- `server/src/modules/evals/scoring.ts` — import scoreRun from here

**Tasks:**

1. `repository.ts` — Drizzle queries:
   - `insertCase(data)` → EvalCase row
   - `findCasesByOwner(ownerId, ownerKind)` → EvalCase[]
   - `findCaseById(id)` → EvalCase | undefined
   - `updateCase(id, data)` → EvalCase
   - `deleteCase(id)` → void
   - `insertRun(data)` → EvalRun row
   - `findRunsByCase(caseId)` → EvalRunRecord[]
   - `findRunsByAgent(agentId, limit)` → EvalRunRecord[] (join eval_cases → filter by owner_id)
   - `findDashboard(workspaceId)` → raw data for EvalDashboard aggregation

2. `service.ts` — business logic:
   - `createCase(input: EvalCaseInput, workspaceId)` → EvalCase
   - `listCases(agentId)` → EvalCase[]
   - `runSingleCase(caseId, agent)`:
     a. Fetch case from DB
     b. Invoke reviewer-core `run()` with `{ diff: case.inputDiff, agent }` — same pattern as reviews/service.ts
     c. Call `scoreCase(case.expectedOutput, findings)`
     d. Insert eval_runs row
     e. Return EvalRunResult
   - `runAllCases(agentId)`:
     a. Fetch all cases for agent
     b. Fetch agent config
     c. For each case: call `runSingleCase` sequentially (avoid parallel LLM hammering)
     d. Aggregate into EvalRun metrics via `scoreRun`
     e. Return EvalRunResult[]
   - `getDashboard(workspaceId)` → EvalDashboard

3. `routes.ts` — Fastify plugin, zod-type-provider:
   ```
   POST   /agents/:id/eval-cases           body: EvalCaseInput
   GET    /agents/:id/eval-cases           → EvalCase[]
   GET    /agents/:id/eval-cases/:caseId   → EvalCase
   PUT    /agents/:id/eval-cases/:caseId   body: EvalCaseInput
   DELETE /agents/:id/eval-cases/:caseId   → 204
   POST   /agents/:id/eval-runs            body: { version_label?: string }
   POST   /agents/:id/eval-cases/:caseId/runs → EvalRunResult
   GET    /agents/:id/eval-runs            → EvalRunRecord[]
   GET    /evals/dashboard                 → EvalDashboard
   ```
   All agent routes validate agent belongs to the workspace (copy pattern from agents/routes.ts).

4. `modules/index.ts` — add:
   ```typescript
   import evals from "./evals/routes.js";
   // in modules object:
   evals,
   ```

### Done when
- `cd server && pnpm typecheck` exits 0
- GET /agents/:id/eval-cases returns 200 (integration test or curl)

---

### Agent B — Client API layer + FindingCard

**Owned paths (no other agent touches these):**
- `client/src/lib/api/evals.ts` (new)
- `client/src/lib/hooks/useEvals.ts` (new)
- `client/src/app/repos/[repoId]/pulls/[number]/_components/FindingCard/FindingCard.tsx` (edit)
- `client/src/app/repos/[repoId]/pulls/[number]/_components/FindingCard/FindingCard.test.tsx` (edit)

**Context to read first:**
- `client/src/lib/api/` — one existing api file for fetch pattern
- `client/src/lib/hooks/` — one existing hook for TanStack Query pattern
- `client/src/app/repos/[repoId]/pulls/[number]/_components/FindingCard/FindingCard.tsx` — current buttons
- `client/src/vendor/shared/contracts/eval-ci.ts` — EvalCaseInput, EvalCase types
- `client/src/vendor/shared/contracts/knowledge.ts` — EvalOwnerKind

**Tasks:**

1. `api/evals.ts` — fetch functions (mirror pattern of other api files):
   ```typescript
   createEvalCase(agentId: string, body: EvalCaseInput): Promise<EvalCase>
   listEvalCases(agentId: string): Promise<EvalCase[]>
   runAllEvals(agentId: string): Promise<EvalRunResult[]>
   runSingleCase(agentId: string, caseId: string): Promise<EvalRunResult>
   listEvalRuns(agentId: string): Promise<EvalRunRecord[]>
   getEvalDashboard(): Promise<EvalDashboard>
   ```

2. `hooks/useEvals.ts` — TanStack Query hooks:
   ```typescript
   useEvalCases(agentId)        → useQuery
   useRunAllEvals(agentId)      → useMutation (invalidates useEvalCases + useEvalRuns)
   useRunSingleCase(agentId)    → useMutation
   useEvalRuns(agentId)         → useQuery
   useCreateEvalCase(agentId)   → useMutation (invalidates useEvalCases)
   useEvalDashboard()           → useQuery
   ```

3. Edit `FindingCard.tsx`:
   - Import `Flask` icon from `lucide-react`
   - Add `agentId?: string` to props (fallback: read from workspace context if available)
   - Add `useCreateEvalCase` mutation
   - Add 4th action button after "Learn":
     ```tsx
     <button
       onClick={() => createEvalCase({
         owner_kind: "agent",
         owner_id: agentId,
         name: slugify(finding.title),
         input_diff: prDiff,          // passed from parent as prop
         expected_output: {
           type: finding.verdict === "accepted" ? "must_find" : "must_not_flag",
           file: finding.file,
           start_line: finding.startLine,
           end_line: finding.endLine ?? finding.startLine,
           severity: finding.severity,
           title: finding.title,
         },
       })}
       disabled={!agentId || (finding.verdict !== "accepted" && finding.verdict !== "dismissed")}
     >
       <Flask size={14} /> Turn into eval case
     </button>
     ```
   - Show toast on success (use existing toast mechanism in the codebase)

4. Update `FindingCard.test.tsx` — add test: button renders when verdict is accepted/dismissed, hidden otherwise.

### Done when
- `cd client && pnpm typecheck` exits 0
- Button visible on FindingCard with accepted/dismissed verdict

---

### Agent C — AgentEditor Evals tab

**Owned paths (no other agent touches these):**
- `client/src/app/agents/[id]/_components/AgentEditor/constants.ts` (edit)
- `client/src/app/agents/[id]/_components/AgentEditor/AgentEditor.tsx` (edit)
- `client/src/app/agents/[id]/_components/AgentEditor/_components/EvalsTab/` (new dir, all files)
- `client/src/app/agents/[id]/_components/AgentEditor/AgentEditor.test.tsx` (edit)

**Context to read first:**
- `client/src/app/agents/[id]/_components/AgentEditor/AgentEditor.tsx` — tabs render pattern
- `client/src/app/agents/[id]/_components/AgentEditor/constants.ts` — TABS array
- `client/src/app/agents/[id]/_components/AgentEditor/_components/SkillsTab/SkillsTab.tsx` — sibling tab pattern
- `client/src/vendor/shared/contracts/eval-ci.ts` — EvalRunRecord, EvalCase types
- Hooks come from `client/src/lib/hooks/useEvals.ts` (created by Agent B — import it)

**Tasks:**

1. Edit `constants.ts` — add evals tab between context and any future stats:
   ```typescript
   { key: "evals", labelKey: "editor.tabs.evals", icon: "FlaskConical" },
   ```

2. Edit `AgentEditor.tsx` — add:
   ```tsx
   import { EvalsTab } from "./_components/EvalsTab/EvalsTab";
   // in render:
   {tab === "evals" && <EvalsTab agentId={agent.id} />}
   ```

3. Create `EvalsTab/EvalsTab.tsx`:
   - Metrics row: RECALL / PRECISION / CITATION ACCURACY / TRACES PASSED
     - Values from `useEvalRuns(agentId)` — compute from latest run
     - Delta = current minus previous run (signed, e.g. "-4pt")
   - "View full dashboard →" link to `/evals/${agentId}`
   - Action row: [Run all evals] button (useRunAllEvals mutation) + [New eval case] button
   - Cases list: `useEvalCases(agentId)` → list of EvalCaseRow
   - Loading skeleton while fetching

4. Create `EvalsTab/EvalCaseRow.tsx`:
   - Green circle (●) = last run passed, Red X (✕) = last run failed, Grey (○) = never run
   - Name, severity badge (CRITICAL/WARNING), category tag
   - "expected N, got N" label from last run's per_trace data
   - Action icons: ▶ Run, ✎ Edit, 🗑 Delete
   - Click row → open EvalCaseModal

5. Create `EvalsTab/EvalCaseModal.tsx`:
   - Full-screen modal (Dialog/overlay)
   - Left pane:
     - Name input field
     - Input tabs: Diff | Files | PR meta
     - Diff tab: syntax-highlighted pre block (monospace, use existing DiffView if available)
   - Right pane:
     - "Expected output" label + JSON textarea
     - "valid JSON" green badge (validate on change) or red "invalid JSON"
     - "Finding skeleton" button → inserts template:
       ```json
       { "type": "must_find", "file": "", "start_line": 0, "severity": "CRITICAL", "title": "" }
       ```
   - Footer left: "Last run: passed/failed · expected N finding(s), got N · Xs · $0.0X" (from last EvalRunRecord)
   - Footer right: Cancel | Run case (useRunSingleCase) | Save (useCreateEvalCase / update)
   - "Run on save" toggle

6. Edit `AgentEditor.test.tsx` — add: Evals tab renders when tab="evals".

### Done when
- `cd client && pnpm typecheck` exits 0
- `cd client && pnpm test` exits 0

---

### Agent D — Eval Dashboard + nav

**Owned paths (no other agent touches these):**
- `client/src/vendor/ui/nav.ts` (edit)
- `client/src/app/evals/` (new directory, all files within)

**Context to read first:**
- `client/src/vendor/ui/nav.ts` — NAV array structure
- `client/src/app/agents/page.tsx` OR `client/src/app/conventions/page.tsx` — page template
- `client/src/vendor/shared/contracts/eval-ci.ts` — EvalDashboard, EvalTrendPoint, EvalRunRecord
- Hooks come from `client/src/lib/hooks/useEvals.ts` (created by Agent B — import it)
- `recharts` is already in client/package.json — use LineChart for trend

**Tasks:**

1. Edit `nav.ts` — add to SKILLS LAB section after "Conventions":
   ```typescript
   {
     key: "eval-dashboard",
     label: "Eval Dashboard",
     icon: "FlaskConical",
     href: "/evals",
     gKey: "e",
   },
   ```

2. Create `client/src/app/evals/page.tsx` — Eval Dashboard:
   ```
   <h1>Eval Dashboard</h1>
   <p>Regression harness across all reviewed agents — pick an agent to see its runs</p>
   [Run all agents] button (runs /agents → run each agent's evals sequentially)

   AGENTS section:
   - useEvalDashboard() → dashboard.recent_runs grouped by owner_id
   - One card per agent: name, version tag, runs count, recall/precision/citation metrics, ▸ navigate

   RECENT EVAL RUNS — ALL AGENTS table:
   Columns: Agent | Ran At | Version | Recall bar | Precision bar | Citation bar | Pass | Cost
   Rows from dashboard.recent_runs (all agents, latest 20)
   ```

3. Create `client/src/app/evals/[agentId]/page.tsx` — Agent eval full page:
   ```
   Header: <AgentName> v<N>  [AgentName dropdown ▾] [30 days ▾] [Run eval]
   Alert banner: if precision delta < -0.01 → "Precision dipped Npts on vX — …"

   Three metric cards: RECALL / PRECISION / CITATION ACCURACY with delta vs previous run

   METRIC TREND (recharts LineChart):
   - x-axis: ran_at (date)
   - y-axis: 0..1
   - 3 lines: Recall (blue), Precision (yellow), Citation (green)
   - data: useEvalRuns(agentId) → map to {date, recall, precision, citation_accuracy}

   RECENT RUNS table:
   - Columns: □ | Ran At | Version | Recall bar | Precision bar | Citation bar | Pass | Cost
   - Checkboxes for selecting 2 runs to compare
   - [Compare] button active when exactly 2 checked → opens CompareModal

   CompareModal:
   - Title: "Compare runs — v{old} → v{new}"
   - Metric deltas row: RECALL +Npt, PRECISION -Npt, CITATION +Npt, COST +$N
   - SYSTEM PROMPT DIFF section: side-by-side old vs new (if agent version config differs)
     - Use simple line diff (split by \n, highlight added/removed lines with green/red bg)
   - [Close] [Promote v{new}] (Promote = navigate to /agents/{agentId}?tab=config)
   ```

4. Create `client/src/app/evals/_components/` — shared sub-components:
   - `MetricBar.tsx` — colored progress bar (blue/yellow/orange based on value thresholds)
   - `RunsTable.tsx` — reusable table used by both EvalDashboard and agent eval page
   - `CompareModal.tsx` — comparison modal

### Done when
- `cd client && pnpm typecheck` exits 0
- `/evals` page renders without errors
- `/evals/[agentId]` page renders with trend chart

---

## Post-wave integration check (single agent after Wave 2 merges)

**Tasks:**
1. `cd server && pnpm exec vitest run src/modules/evals/` — all green
2. `cd client && pnpm test` — all green
3. `cd server && pnpm typecheck && cd ../client && pnpm typecheck` — both green
4. Start dev server (`./scripts/dev.sh`) and manually verify:
   - FindingCard shows "Turn into eval case" on an accepted finding
   - Clicking creates a case (check network tab → 201)
   - AgentEditor Evals tab appears and renders cases list
   - /evals sidebar link navigates to dashboard page
5. If typecheck fails: fix imports (most likely Agent C or D importing non-existent hook)

---

## File ownership summary (no overlaps)

| Agent | Files |
|---|---|
| Wave 1 | `server/src/db/schema/index.ts`, `server/src/modules/evals/scoring.ts`, `server/src/modules/evals/scoring.test.ts`, migrations |
| A (Server) | `server/src/modules/evals/repository.ts`, `service.ts`, `routes.ts`, `server/src/modules/index.ts` |
| B (API+FindingCard) | `client/src/lib/api/evals.ts`, `client/src/lib/hooks/useEvals.ts`, `FindingCard.tsx`, `FindingCard.test.tsx` |
| C (EvalsTab) | `AgentEditor/constants.ts`, `AgentEditor.tsx`, `AgentEditor.test.tsx`, `AgentEditor/_components/EvalsTab/**` |
| D (Dashboard) | `client/src/vendor/ui/nav.ts`, `client/src/app/evals/**` |
