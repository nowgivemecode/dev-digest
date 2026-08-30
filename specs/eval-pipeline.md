# Eval Pipeline — specs/eval-pipeline.md

## Problem

After changing an agent's system prompt, model, or linked skills there is no
automated way to know whether the review quality improved or regressed.
This spec adds a regression harness built directly into the product: eval cases
live in Postgres alongside findings, the scoring is pure TypeScript (no LLM),
and the UI surfaces recall / precision / citation_accuracy per agent run.

---

## Scope (L06 core only — no stretch goals)

| In scope | Out of scope |
|---|---|
| eval_cases CRUD (agent owner only) | skill-level eval cases |
| POST /agents/:id/eval-runs (invokes reviewer-core) | CI export of evals |
| Code-only scoring (file + line overlap) | conformance checks |
| FindingCard → eval case (one click) | Case editor / manual diff paste |
| AgentEditor Evals tab | Trend graphs (stretch) |
| Eval Dashboard sidebar page | Multi-agent comparison |

---

## Data model (already in schema/eval.ts — DO NOT re-create)

```
eval_cases
  id            uuid PK
  workspace_id  uuid FK workspaces
  owner_kind    "skill"|"agent"
  owner_id      uuid
  name          text
  input_diff    text          -- raw unified diff fed to the agent
  input_files   jsonb         -- optional: { path, content }[]
  input_meta    jsonb         -- optional: { pr_title, pr_body, repo }
  expected_output jsonb       -- EvalExpectedOutput (see below)
  notes         text

eval_runs
  id              uuid PK
  case_id         uuid FK eval_cases
  ran_at          timestamptz
  actual_output   jsonb       -- Finding[] the agent produced
  pass            boolean
  recall          float8
  precision       float8
  citation_accuracy float8
  duration_ms     int
  cost_usd        float8
```

### EvalExpectedOutput shape (stored in expected_output jsonb)

```typescript
type EvalExpectedOutput =
  | { type: "must_find";     file: string; start_line: number; end_line?: number; severity?: string; title?: string }
  | { type: "must_not_flag"; file: string; start_line: number; end_line?: number }
```

"Turn into eval case" from an **accepted** finding → `must_find`.  
"Turn into eval case" from a **dismissed** finding → `must_not_flag`.

---

## API routes  (new module server/src/modules/evals/)

| Method | Path | Body / Response |
|---|---|---|
| POST | /agents/:id/eval-cases | EvalCaseInput → EvalCase |
| GET  | /agents/:id/eval-cases | → EvalCase[] |
| GET  | /agents/:id/eval-cases/:caseId | → EvalCase |
| PUT  | /agents/:id/eval-cases/:caseId | EvalCaseInput → EvalCase |
| DELETE | /agents/:id/eval-cases/:caseId | 204 |
| POST | /agents/:id/eval-runs | RunEvalsInput → EvalRunResult[] |
| POST | /agents/:id/eval-cases/:caseId/runs | → EvalRunResult |
| GET  | /agents/:id/eval-runs | → EvalRunRecord[] (latest first) |
| GET  | /evals/dashboard | → EvalDashboard |

### RunEvalsInput
```typescript
{ version_label?: string }   // optional tag stored in actual_output.meta
```

---

## Scoring algorithm (no LLM calls)

```
For each eval_case in the agent's set:
  1. Run reviewer-core on case.input_diff with the agent's current config
     → produces Finding[]  (this IS an LLM call — scoring itself is not)
  2. Match each expected_output against actual findings:
       overlap(a, b) = same file AND ranges intersect (±5 line tolerance)
  3. must_find  case passes  if ANY actual finding overlaps expected
     must_not_flag case passes if NO actual finding overlaps expected
  4. Store per-trace result in eval_runs row

Aggregate metrics across all cases in the run:
  recall            = passed_must_find  / total_must_find        (1 if none)
  precision         = passed_must_not_flag / total_must_not_flag (1 if none)
  citation_accuracy = grounded_findings / total_findings          (1 if none)
    where grounded = finding.startLine !== null (survived grounding gate)
```

---

## FindingCard change

File: `client/src/app/repos/[repoId]/pulls/[number]/_components/FindingCard/FindingCard.tsx`

Add a 4th action button **"Turn into eval case"** (flask icon, `lucide-react`).

Button is shown when:
- Finding has `accepted` OR `dismissed` verdict (not pending/unreviewed)
- User has an active agent in the workspace

On click:
```
POST /agents/:agentId/eval-cases
{
  owner_kind: "agent",
  owner_id: agentId,
  name: slugify(finding.title),          // e.g. "stripe-key-leak"
  input_diff: prDiff,                     // full diff of the current PR
  expected_output: {
    type: verdict === "accepted" ? "must_find" : "must_not_flag",
    file: finding.file,
    start_line: finding.startLine,
    end_line: finding.endLine ?? finding.startLine,
    severity: finding.severity,           // only for must_find
    title: finding.title                  // only for must_find
  }
}
```

Show toast: "Eval case created" with link to AgentEditor → Evals tab.

---

## AgentEditor — Evals tab

File: new `client/src/app/agents/[id]/_components/AgentEditor/_components/EvalsTab/`

Position: between "Context" and "Stats" tabs.

### Layout (matches screenshot 21)

```
┌─ EVAL METRICS ──────────────────────────────────── View full dashboard →
│  RECALL 82% (-4pt)  PRECISION 91% (-2pt)  CITATION 95% (-1pt)  17/20
│
├─ [Run all evals]  [New eval case]          (right-aligned)
│
├─ EVAL CASES  3/5 agents
│  ● stripe-key-leak          CRITICAL · security   expected 1, got 1  [▶][✎][🗑]
│  ✕ ssrf-webhook             CRITICAL · security   expected 1, got 0  [▶][✎][🗑]
│  ● missing-retry-after      WARNING  · bug        expected 1, got 1  [▶][✎][🗑]
│  ● clean-refactor-no-flags  —        · empty      expected 0, got 0  [▶][✎][🗑]
│  ● service-role-in-client   CRITICAL · security   expected 1, got 1  [▶][✎][🗑]
└──────────────────────────────────────────────────────────────────────────
```

- Green circle = last run passed, Red X = failed, Grey = never run
- Metrics show delta vs previous run (signed, e.g. "-4pt")
- "Run all evals" → POST /agents/:id/eval-runs → streams progress via SSE or polls
- Case row click → opens EvalCaseModal

### EvalCaseModal (screenshot 22)

Full-screen modal (not inline):
- Left: Name field + Input tabs (Diff | Files | PR meta) with syntax-highlighted diff viewer
- Right: Expected output JSON editor with "valid JSON" badge + "Finding skeleton" button
  - "Finding skeleton" inserts a template must_find JSON
- Footer: "Last run passed/failed · expected N findings, got N · Xs · $0.0X"
- Actions: Cancel | Run case | Save  + "Run on save" toggle

---

## Eval Dashboard page (sidebar)

Route: `client/src/app/evals/page.tsx`  
Sidebar label: **Eval Dashboard** (between Conventions and Memory based on screenshot 18)

### Layout (matches screenshot 18)

```
Eval Dashboard                                   [Run all agents]
Regression harness across all reviewed agents — pick an agent to see its runs

AGENTS
┌─ Security Reviewer   v7 · 7 runs   [sparkline]  RECALL 82%  PREC 91%  CIT 95%  ›
├─ Performance Reviewer  v19 · 7 runs [sparkline]  RECALL 74%  PREC 88%  CIT 90%  ›
└─ Custom Mentor        v10 · 6 runs  [sparkline]  RECALL 83%  PREC 79%  CIT 85%  ›

RECENT EVAL RUNS — ALL AGENTS
┌─────────────────┬──────┬───────┬────────────────────┬──────┬──────┐
│ Agent           │ Run  │ Ver   │ Recall/Prec/Cit    │ Pass │ Cost │
├─────────────────┼──────┼───────┼────────────────────┼──────┼──────┤
│ Security Rev.   │ date │ v7    │ ████ 82% 75% 77%   │ 17/20│$2.23 │
│ ...             │      │       │                    │      │      │
└─────────────────┴──────┴───────┴────────────────────┴──────┴──────┘
```

Agent card click → navigates to `/evals/[agentId]`

### Agent eval full page `/evals/[agentId]/page.tsx` (screenshot 19)

```
Security Reviewer  v7-1                    [Security Reviewer ▾] [30 days ▾] [Run eval]
Regression harness: 5 runs on the 20-trace gold set

⚠ Precision dipped 2pts on v7 — a new false positive slipped in. Recall and citation both up.

RECALL 82% (-0.04)   PRECISION 91% (-0.02)   CITATION ACCURACY 95% (+0.01)

METRIC TREND  [Recall ─] [Precision ─] [Citation ─]
  (recharts LineChart, x=ran_at, y=metric value, 3 lines)

RECENT RUNS                                              [Compare]
┌──────────┬──────┬───────┬──────┬──────┬──────┬──────┬──────┐
│ RAN AT   │ VER  │ RECALL│ PREC │ CIT  │ PASS │ COST │  □   │
├──────────┼──────┼───────┼──────┼──────┼──────┼──────┼──────┤
│ date     │  v7  │ ████  │ ████ │ ████ │ 17/20│$2.23 │  □   │
│ ...      │      │       │      │      │      │      │      │
└──────────┴──────┴───────┴──────┴──────┴──────┴──────┴──────┘
```

Checkboxes select 2 runs → [Compare] becomes active.

### Compare modal (screenshot 20)

```
Compare runs — v6 → v7

RECALL 82% (+4pt)  PRECISION 91% (-1pt)  CITATION 94% (+5pt)  COST 0.23 (+0.03)

SYSTEM PROMPT DIFF
  v6 (old)                          v7 (new)
  ┌────────────────────────────────────────────────────────┐
  │ + Flag unused imports as suggestions.                  │
  │   Every finding MUST cite file and start_line…        │
  └────────────────────────────────────────────────────────┘

[Close]  [Promote v7]
```

"Promote v7" → navigates to AgentEditor Config tab (no automatic save).

---

## Sidebar navigation

Add **"Eval Dashboard"** link to the left sidebar under Conventions.  
File: find the sidebar nav component and add the item.

---

## Migration

The schema file already exists at `server/src/db/schema/eval.ts`.  
Need to:
1. Export `evalCases` and `evalRuns` from `server/src/db/schema/index.ts`
2. Run `pnpm db:generate` then `pnpm db:migrate`

---

## Tests

- `server/src/modules/evals/scoring.test.ts` — unit tests for scoring logic (no DB, no LLM)
  - must_find: overlap hit → pass, no overlap → fail
  - must_not_flag: no overlap → pass, overlap → fail
  - recall/precision/citation_accuracy calculations
- `client`: update `AgentEditor.test.tsx` to include Evals tab render

---

## Acceptance criteria

- [ ] ≥ 8 eval cases exist (created from real findings from L01–L05 PRs)
- [ ] "Turn into eval case" button on FindingCard works for both accepted and dismissed findings
- [ ] POST /agents/:id/eval-runs runs all cases and returns recall/precision/citation_accuracy
- [ ] Scoring has zero LLM calls (only reviewer-core invocation per case has LLM; the metric computation is pure TS)
- [ ] Changing system prompt produces visible metric change between two runs
- [ ] AgentEditor Evals tab shows cases list + aggregate metrics
- [ ] Eval Dashboard page shows all agents + recent runs
- [ ] `cd server && pnpm exec vitest run src/modules/evals/` is green
