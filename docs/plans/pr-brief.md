# Development Plan: PR Why + Risk Brief

## Overview

Adds a "PR Brief" feature that distils pre-computed intent and blast-radius signals into a single
structured card (`what`, `why`, `risk_level`, `risks[]`, `review_focus[]`). The card is generated
by one LLM call (8,000-token hard budget), cached per `(pr_id, head_sha)`, and surfaced on the
Overview tab as `PrBriefCard`.

## Requirements

- R1: `POST /pulls/:id/brief` — compute-if-absent, cached per `(pr_id, head_sha)`.
- R2: `POST /pulls/:id/brief/recompute` — force fresh LLM call, rate-limited 10/min/workspace.
- R3: Brief prompt built from intent + blast + pr metadata + files (no patch bodies) + linked issue.
- R4: Token budget 8,000 — truncation priority: issue body → file list (60 max) → PR body → blast callers.
- R5: Grounding gate: every `risks[].file_refs` and `review_focus[]` item references only inputs sent to the model.
- R6: `PrBriefCard` on Overview tab with coloured risk badge, clickable `review_focus` list, skeleton, error state.
- R7: `risk_brief` feature-model slot used (already in `FeatureModelId`; default openai/gpt-4.1).

## Affected modules & contracts

- `server/src/db/schema/reviews.ts` — `prBrief` table: add `id UUID PK`, `head_sha TEXT NOT NULL` column + unique index on `(pr_id, head_sha)`; keep `pr_id` as a regular column (not PK).
- `server/src/db/migrations/` — one new migration file for the schema change.
- `server/src/modules/brief/` — new module: `routes.ts`, `service.ts`, `repository.ts`, `classifier.ts`, `constants.ts`.
- `server/src/modules/index.ts` — register the new `brief` module.
- `server/src/vendor/shared/contracts/` — new file `pr-brief.ts` with `Brief`, `Risk`, `BriefRecord` Zod schemas; barrel export added to `index.ts`.
- `client/src/lib/hooks/brief.ts` — new TanStack Query hooks (`useBrief`, `useRecomputeBrief`).
- `client/src/app/repos/[repoId]/pulls/[number]/_components/OverviewTab/` — add `PrBriefCard.tsx`; update `OverviewTab.tsx` to mount it.
- `client/messages/en/prReview.json` — add `brief.*` i18n keys.
- Contracts: new file `server/src/vendor/shared/contracts/pr-brief.ts` (added, NOT editing existing files).

## Architecture changes

- **Domain (shared contract):** `server/src/vendor/shared/contracts/pr-brief.ts` — `Brief`, `Risk`, `BriefRecord` Zod schemas. Pure data; no I/O.
- **Infrastructure (DB):** `prBrief` table gains `head_sha` column + unique index `(pr_id, head_sha)`. Old single-row-per-PR semantics upgrade to one-row-per-SHA.
- **Application (service):** `BriefService` (`server/src/modules/brief/service.ts`) — orchestrates intent load, blast load, file load, prompt build, LLM call, grounding check, upsert. No SQL; delegates to `BriefRepository`.
- **Application (classifier):** `buildBriefPrompt` helper (`server/src/modules/brief/classifier.ts`) — pure function: accepts typed inputs, applies truncation rules, wraps untrusted content via `wrapUntrusted`, returns assembled messages array. No I/O.
- **Infrastructure (repository):** `BriefRepository` (`server/src/modules/brief/repository.ts`) — Drizzle queries only: `getBrief(prId, headSha)`, `upsertBrief(prId, headSha, brief)`.
- **Presentation (routes):** `brief/routes.ts` — two POST handlers; rate-limit on recompute only; response serialised via `BriefRecord` Zod schema.
- **Client (hook):** `client/src/lib/hooks/brief.ts` — `useBrief` (POST compute-if-absent), `useRecomputeBrief` (POST recompute); pattern mirrors `hooks/intent.ts`.
- **Client (UI):** `PrBriefCard` is a `"use client"` component inside the existing `OverviewTab/` folder; `OverviewTab.tsx` adds `<PrBriefCard prId={prId} />` alongside `<IntentCard>`.

## Phased tasks

### Phase 1 — Contracts & schema (foundation; all parallel-safe)

- **T1 — Shared contract: `PrBrief`, `PrBriefRisk`, `PrBriefRecord`**
  - **Action:** Create `server/src/vendor/shared/contracts/pr-brief.ts` with Zod schemas matching the spec's `Brief`, `Risk`, `BriefRecord` interfaces. Export names use `PrBrief*` prefix to avoid barrel collision with existing `Risk` and `Brief*` exports from `brief.ts`. Concretely: `PrBriefRiskSchema` (individual risk item), `PrBriefSchema` (the full brief), `PrBriefRecordSchema` (brief + cache metadata). Export type aliases `PrBrief`, `PrBriefRisk`, `PrBriefRecord`. Add `export * from './contracts/pr-brief.js'` to `server/src/vendor/shared/index.ts`. Mirror the new file to `client/src/vendor/shared/contracts/pr-brief.ts` (and its barrel `client/src/vendor/shared/index.ts`) to keep vendor copies in sync.
  - **Module:** server (shared)
  - **Type:** backend
  - **Skills to use:** zod, typescript-expert
  - **Owned paths:** `server/src/vendor/shared/contracts/pr-brief.ts`, `server/src/vendor/shared/index.ts`, `client/src/vendor/shared/contracts/pr-brief.ts`, `client/src/vendor/shared/index.ts`
  - **Depends-on:** none
  - **Risk:** low
  - **Known gotchas:** Existing `brief.ts` already exports `Risk` — using `PrBrief*` prefix entirely avoids barrel collision. Do NOT append to existing `brief.ts`; create a new file. Check `server/src/vendor/shared/index.ts` for any existing `export * from './contracts/pr-brief.js'` before adding.
  - **Acceptance:** `cd server && pnpm exec tsc --noEmit` passes. Types `PrBrief`, `PrBriefRecord`, `PrBriefRisk` are importable from `@devdigest/shared` in a test file. No duplicate export errors from barrel.
  - **Covers:** AC-01, AC-04, AC-06, AC-07

- **T2 — DB schema: add `head_sha` to `pr_brief`**
  - **Action:** Edit `server/src/db/schema/reviews.ts`: change `prBrief` so it has a UUID `id` PK (or keep `prId` as PK if only one row per PR is allowed — but spec says one row per SHA so a `head_sha` TEXT NOT NULL column + unique index `(pr_id, head_sha)` is required). Concretely: drop the current single-column PK on `prId`; add `id uuid PK defaultRandom()`, `headSha text('head_sha').notNull()`, `computedAt timestamp`, keep `prId` as FK; add `uniqueIndex('pr_brief_pr_sha_uq').on(t.prId, t.headSha)`. Also add `computedAt: now()` timestamp column.
  - **Module:** server
  - **Type:** backend
  - **Skills to use:** drizzle-orm-patterns, postgresql-table-design
  - **Owned paths:** `server/src/db/schema/reviews.ts`
  - **Depends-on:** none
  - **Risk:** medium (changes existing table shape — must be a clean migration, not breaking for existing empty table)
  - **Known gotchas:** `pr_brief` table currently has `prId` as its PK. If any data exists, the migration must handle the existing rows. Since this is the first real use of the table, it should be safe to drop and recreate via `ALTER TABLE` steps. Use `drizzle-kit generate` after editing the schema to produce the migration SQL automatically.
  - **Acceptance:** `cd server && pnpm db:migrate` completes without error. `\d pr_brief` in psql shows `head_sha`, `computed_at` columns and unique index on `(pr_id, head_sha)`.
  - **Covers:** AC-01, AC-02, AC-03 (NF-02)

- **T3 — DB migration file**
  - **Action:** Run `cd server && pnpm drizzle-kit generate` (after T2 schema change) to produce the next migration SQL file in `server/src/db/migrations/`. Verify the generated SQL reflects the new columns and unique index. Commit the generated file.
  - **Module:** server
  - **Type:** backend
  - **Skills to use:** drizzle-orm-patterns
  - **Owned paths:** `server/src/db/migrations/<next-migration>.sql`, `server/src/db/migrations/meta/`
  - **Depends-on:** T2
  - **Risk:** low
  - **Known gotchas:** `drizzle-kit generate` must be run from inside `server/`. The meta `_journal.json` is auto-updated; commit it alongside the SQL file.
  - **Acceptance:** Migration file exists, `pnpm db:migrate` applies it cleanly on a fresh schema.
  - **Covers:** AC-01 (NF-02)

### Phase 2 — Backend module (sequential within module, parallel-safe with Phase 1)

- **T4 — `BriefRepository`: DB access layer**
  - **Action:** Create `server/src/modules/brief/repository.ts`. Implement `getBrief(db, prId, headSha): Promise<BriefRecord | undefined>` and `upsertBrief(db, prId, headSha, brief): Promise<BriefRecord>`. Use Drizzle `.insert(...).onConflictDoUpdate(...)` targeting the unique index `(pr_id, head_sha)`. Return type maps DB columns → `BriefRecord` shape. No business logic.
  - **Module:** server
  - **Type:** backend
  - **Skills to use:** drizzle-orm-patterns, onion-architecture
  - **Owned paths:** `server/src/modules/brief/repository.ts`
  - **Depends-on:** T2, T3
  - **Risk:** low
  - **Known gotchas:** `pr_brief.json` column is `jsonb` — cast via `.$type<Brief>()` in Drizzle. The `computedAt` column uses Drizzle's `now()` helper (from `schema/_shared.ts`) so it auto-fills on insert.
  - **Acceptance:** Unit test `brief/repository.test.ts` passes: mock db, call `upsertBrief`, verify SQL via `vi.spyOn`. `pnpm exec vitest run --exclude '**/*.it.test.ts'` green.
  - **Covers:** AC-01, AC-02

- **T5 — `classifier.ts`: prompt builder + LLM caller**
  - **Action:** Create `server/src/modules/brief/classifier.ts`. Export `buildBriefPrompt(opts: BuildBriefPromptOpts): { messages: LLMMessage[]; allowedRefs: Set<string> }` (pure, no I/O) and `callBriefLlm(llm, model, messages, allowedRefs, logger): Promise<Brief>`. `buildBriefPrompt` applies truncation in spec order (NF-01): (1) linked issue body → 500 chars, (2) file list sort by `additions+deletions` desc, keep top 60, (3) PR body → 1,000 chars, (4) blast callers → 50. Wraps PR body, issue body with `wrapUntrusted`. Returns `allowedRefs` = Set of all file paths + endpoints sent to model (for grounding gate). `callBriefLlm` calls `llm.completeStructured` with `Brief` Zod schema, then validates every `file_refs` entry and `review_focus` item against `allowedRefs` — drops invalid entries (grounding gate, AC-06, AC-07). Token estimate uses `Math.ceil(chars/4)` heuristic (mirrors classifier.ts). Hard budget: if estimated > 8000, log warning and proceed (ERR-05).
  - **Module:** server
  - **Type:** backend
  - **Skills to use:** onion-architecture, security, typescript-expert, zod
  - **Owned paths:** `server/src/modules/brief/classifier.ts`
  - **Depends-on:** T1
  - **Risk:** medium (grounding logic is core correctness requirement)
  - **Known gotchas:** `wrapUntrusted` is in `platform/prompt.ts` — import path is `../../platform/prompt.js`. The `LLMMessage` type may not be a named export; check `adapters.ts` in shared for the exact type name (`LLMProvider['completeStructured']` input shape). Use `Brief` Zod schema from the new contract (T1). The classifier must NEVER pass `pr_files.patch` — only `path`, `additions`, `deletions` are allowed (NF-07).
  - **Acceptance:** Unit test `brief/classifier.test.ts`: (a) verifies truncation rules are applied in correct order, (b) verifies file paths > 60 are dropped keeping highest-churn first, (c) verifies `allowedRefs` only contains inputs passed to model, (d) verifies grounding drop of invalid `file_refs`. `pnpm exec vitest run --exclude '**/*.it.test.ts'` green.
  - **Covers:** AC-04, AC-05, AC-06, AC-07 (NF-01, NF-05, NF-07)

- **T6 — `BriefService`: orchestration layer**
  - **Action:** Create `server/src/modules/brief/service.ts`. Class `BriefService(container, logger?)`. Methods:
    - `getOrCompute(workspaceId, prId): Promise<PrBriefRecord>` — (1) load PR via `reviewRepo.getPull`; 404 if missing (AC-12). (2) Snapshot `headSha = pull.headSha`. (3) Check cache via `BriefRepository.getBrief(prId, headSha)` — return if hit. (4) Else call `this.computeWithPull(workspaceId, pull, headSha)`.
    - `recompute(workspaceId, prId): Promise<PrBriefRecord>` — (1) load PR; 404 if missing. (2) Snapshot headSha. (3) Always call `this.computeWithPull(workspaceId, pull, headSha)`.
    - `private computeWithPull(workspaceId, pull, headSha): Promise<PrBriefRecord>` — receives the already-loaded PR + its headSha so cache key is consistent with the inputs. Steps: (1) Load intent via `IntentService.getOrCompute` (ERR-01). (2) Load blast via `container.repoIntel.getBlastRadius(repoId, filePaths)`; empty arrays on degraded (ERR-02). (3) Load PR files (no patch) via `reviewRepo.getPrFiles`. (4) Resolve linked issue via GitHub client best-effort (ERR-03). (5) Resolve feature model `risk_brief` via `resolveFeatureModel`. (6) Build prompt + call LLM via `classifier.ts`. (7) On LLM error throw 502 `brief_llm_error` (ERR-04). (8) Upsert via `BriefRepository.upsertBrief(prId, headSha, brief)` — uses the SAME headSha snapshotted before any async work. (9) Return `PrBriefRecord`.
  - **Module:** server
  - **Type:** backend
  - **Skills to use:** onion-architecture, fastify-best-practices, typescript-expert
  - **Owned paths:** `server/src/modules/brief/service.ts`
  - **Depends-on:** T4, T5
  - **Risk:** medium
  - **Known gotchas:** `reviewRepo.getPrFiles` returns `patch` column — the service MUST NOT pass `patch` to the classifier (strip it before passing). `container.repoIntel.getBlastRadius` may return `degraded: true` with empty arrays — this is not an error per ERR-02. Issue parsing mirrors `intent/service.ts` pattern: use `parseReferences` from `intent/references.ts` and `github.getIssue`.
  - **Acceptance:** Integration test `brief/service.it.test.ts`: (a) cache-miss path calls LLM once and persists (AC-01), (b) cache-hit path returns same record without LLM call (AC-02), (c) recompute always calls LLM (AC-03), (d) missing PR returns NotFoundError (AC-12). `pnpm exec vitest run .it.test` green (needs Docker).
  - **Covers:** AC-01, AC-02, AC-03, AC-04, AC-08, AC-12 (ERR-01 through ERR-04)

- **T7 — `constants.ts` + `routes.ts`: presentation layer**
  - **Action:** Create `server/src/modules/brief/constants.ts` with `BRIEF_SYSTEM_PROMPT` string. Create `server/src/modules/brief/routes.ts` as a Fastify plugin: `POST /pulls/:id/brief` (no rate limit — cache hits are free) returns `BriefRecord`; `POST /pulls/:id/brief/recompute` (rate-limit `{ max: 10, timeWindow: '1 minute' }`) returns `BriefRecord`. Both handlers: `getContext → BriefService → reply`. Add `404` error pass-through (Fastify's `NotFoundError` → 404 already wired via `platform/errors.ts`). Declare response schema as `BriefRecord` Zod object via `fastify-type-provider-zod` (mirrors intent/routes.ts pattern).
  - **Module:** server
  - **Type:** backend
  - **Skills to use:** fastify-best-practices, onion-architecture, zod
  - **Owned paths:** `server/src/modules/brief/constants.ts`, `server/src/modules/brief/routes.ts`
  - **Depends-on:** T6
  - **Risk:** low
  - **Known gotchas:** Rate-limit config `config: { rateLimit: { max: 10, timeWindow: '1 minute' } }` is disabled under `NODE_ENV=test` (global middleware), so integration tests are not affected. The `POST /pulls/:id/brief` (compute-if-absent) must NOT carry the rate limit per NF-04.
  - **Acceptance:** `curl -X POST http://localhost:3001/pulls/<valid-uuid>/brief` returns JSON with `what`, `why`, `risk_level`, `risks`, `review_focus`, `head_sha`, `computed_at`. Calling twice returns the same `computed_at` (cache hit). Recompute endpoint returns HTTP 429 on the 11th call within a minute.
  - **Covers:** AC-01, AC-02, AC-03, AC-12, AC-13

- **T8 — Register `brief` module in `modules/index.ts`**
  - **Action:** Add `import brief from './brief/routes.js'` and `brief` entry to the `modules` record in `server/src/modules/index.ts`.
  - **Module:** server
  - **Type:** backend
  - **Skills to use:** fastify-best-practices
  - **Owned paths:** `server/src/modules/index.ts`
  - **Depends-on:** T7
  - **Risk:** low
  - **Known gotchas:** Module name `brief` must not conflict with other keys. It does not.
  - **Acceptance:** `cd server && pnpm dev` boots without error; `POST /pulls/:id/brief` returns a response (even a 404 for a missing PR, not a 404 for route-not-found).
  - **Covers:** AC-01

### Phase 3 — Client (parallel-safe with each other; depends on T7 being deployed or types available)

- **T9 — TanStack Query hooks: `useBrief`, `useRecomputeBrief`**
  - **Action:** Create `client/src/lib/hooks/brief.ts`. `useBrief(prId, headSha)` — accepts `headSha` as a second parameter (passed from the PR detail page that already has the pull object); calls `api.post<PrBriefRecord>(\`/pulls/\${prId}/brief\`)` via `useQuery` with `queryKey: ['brief', prId, headSha]`. When headSha changes (PR updated), TanStack Query treats it as a new key and refetches automatically. `useRecomputeBrief(prId)` — `useMutation` calling `api.post<PrBriefRecord>(\`/pulls/\${prId}/brief/recompute\`)`, `onSuccess` calls `queryClient.invalidateQueries({ queryKey: ['brief', prId] })` (prefix invalidation covers any SHA). Pattern mirrors `client/src/lib/hooks/intent.ts` exactly. Import `PrBriefRecord` from `@devdigest/shared` (client vendor copy).
  - **Module:** client
  - **Type:** ui
  - **Skills to use:** react-best-practices, next-best-practices, typescript-expert
  - **Owned paths:** `client/src/lib/hooks/brief.ts`
  - **Depends-on:** T1 (contract types available)
  - **Risk:** low
  - **Known gotchas:** `useBrief` uses `useQuery` with a `queryFn` that calls `api.post` (not `api.get`) — TanStack Query queryFn can call any async function; the method is POST per spec (compute-if-absent is POST, not GET).
  - **Acceptance:** Unit test `client/src/lib/hooks/brief.test.ts` passes: mock `fetch`, assert `useBrief('id', 'sha-a')` fires POST to `/pulls/id/brief` with queryKey `['brief', 'id', 'sha-a']`; assert changing headSha to `'sha-b'` causes a new fetch; assert `useRecomputeBrief` mutation fires POST to recompute and invalidates `['brief', 'id']` prefix. `cd client && pnpm test` green.
  - **Covers:** AC-01, AC-02, AC-03

- **T10 — `PrBriefCard` component + i18n keys**
  - **Action:** Create `client/src/app/repos/[repoId]/pulls/[number]/_components/OverviewTab/PrBriefCard.tsx`. It is a `"use client"` component. Props: `{ prId: string; headSha: string }`. Behaviour:
    - On mount: call `useBrief(prId, headSha)` (triggers POST compute-if-absent; query key includes headSha so stale cache is never served after a PR update).
    - Loading state: render 3 `<Skeleton>` rows (AC-11).
    - Error state: inline error message + "Try again" button that calls `brief.refetch()` (re-triggers the compute-if-absent POST, does NOT use the rate-limited recompute endpoint — ERR-06).
    - Loaded state:
      - Risk level badge: coloured `<span>` or `<Badge>` — green/yellow/orange/red for low/medium/high/critical (AC-09). Use CSS custom properties (`--ok`, `--warn`, `--error`, `--critical`) or inline hex.
      - `what` and `why` as short text paragraphs.
      - `risks[]`: ordered list — each item shows `title` + `explanation` + `severity` badge.
      - `review_focus[]`: clickable list — `onClick` calls `navigator.clipboard.writeText(item)` (AC-10). Show a transient "Copied!" feedback (1.5 s).
    - "Recompute" ghost button (top-right, mirrors `IntentCard` pattern) calls `useRecomputeBrief.mutate()`.
    Add i18n strings to `client/messages/en/prReview.json` under `"brief"` key. Use `useTranslations("prReview")` in the component — no hardcoded English strings.
  - **Module:** client
  - **Type:** ui
  - **Skills to use:** react-best-practices, next-best-practices, react-testing-library, frontend-architecture
  - **Owned paths:** `client/src/app/repos/[repoId]/pulls/[number]/_components/OverviewTab/PrBriefCard.tsx`, `client/messages/en/prReview.json`
  - **Depends-on:** T9
  - **Risk:** low
  - **Known gotchas:** `navigator.clipboard.writeText` requires HTTPS or `localhost` — fine for dev but could fail in iframe-embedded envs. Wrap in `try/catch`. The `"critical"` colour token may not exist in the design system; use `var(--error)` or `#d32f2f` as a fallback. Check `client/src/vendor/ui/` for existing Badge/colour tokens.
  - **Acceptance:** Unit test `PrBriefCard.test.tsx` (React Testing Library): (a) renders skeleton while loading, (b) renders risk badge with correct colour class/style for each `risk_level`, (c) clicking a `review_focus` item calls `navigator.clipboard.writeText`, (d) error state shows "Try again" button that calls `brief.refetch()` (not the recompute mutation). `cd client && pnpm test` green.
  - **Covers:** AC-09, AC-10, AC-11 (ERR-06)

- **T11 — Mount `PrBriefCard` in `OverviewTab`**
  - **Action:** Edit `client/src/app/repos/[repoId]/pulls/[number]/_components/OverviewTab/OverviewTab.tsx`: add `import { PrBriefCard } from './PrBriefCard'`; render `{prId && headSha && <PrBriefCard prId={prId} headSha={headSha} />}` above `IntentCard` (brief → intent → description, top to bottom). `headSha` is already available from the pull object in the parent page.
  - **Module:** client
  - **Type:** ui
  - **Skills to use:** react-best-practices, frontend-architecture
  - **Owned paths:** `client/src/app/repos/[repoId]/pulls/[number]/_components/OverviewTab/OverviewTab.tsx`
  - **Depends-on:** T10
  - **Risk:** low
  - **Known gotchas:** `OverviewTab.tsx` already imports `IntentCard` and uses `prId`. The component is already `"use client"`. No RSC boundary changes needed.
  - **Acceptance:** Navigate to any PR's Overview tab in the running app; `PrBriefCard` renders (skeleton → data or error). `cd client && pnpm test` green (snapshot if any).
  - **Covers:** AC-09, AC-10, AC-11 (G5)

## Testing strategy

```sh
# Server unit (no Docker):
cd server && pnpm exec vitest run --exclude '**/*.it.test.ts'
# Covers: T4 (repository.test.ts), T5 (classifier.test.ts), T7 (routes unit)

# Server integration (needs Docker):
cd server && pnpm exec vitest run .it.test
# Covers: T6 (service.it.test.ts) — cache-miss, cache-hit, recompute, 404

# Client unit:
cd client && pnpm test
# Covers: T9 (brief.test.ts hooks), T10 (PrBriefCard.test.tsx)
```

Key test files to create:
- `server/src/modules/brief/repository.test.ts` — unit, mock db
- `server/src/modules/brief/classifier.test.ts` — unit, pure function (no LLM mock needed beyond verifying `completeStructured` is called once)
- `server/src/modules/brief/service.it.test.ts` — integration, real Postgres + mock LLM via `ContainerOverrides`
- `client/src/lib/hooks/brief.test.ts` — unit, mock fetch
- `client/src/app/repos/[repoId]/pulls/[number]/_components/OverviewTab/PrBriefCard.test.tsx` — RTL

## Risks & mitigations

- **Name collision in `@devdigest/shared`:** existing `brief.ts` already exports `Risk`. The new spec's `Risk` interface overlaps in name. → **Mitigation:** Name new types `BriefRisk` (individual risk item) and `Brief` + `BriefRecord` (the spec names these distinctly from the existing `Risks` wrapper). Add new types to existing `brief.ts` or a new `pr-brief.ts` file. Either way, ensure no duplicate export name hits the barrel. Implementer must check barrel for collisions before adding.
- **LLM latency 30s:** `completeStructured` for GPT-4.1 on a complex prompt may hit 15–25 s under load. → **Mitigation:** NF-03 allows 30 s; no SSE needed. Fastify default request timeout is usually 30 s — confirm `config.requestTimeout` in `platform/config.ts` is ≥ 30 s or increase.
- **`head_sha` migration:** existing `pr_brief` rows (if any) would violate NOT NULL on `head_sha`. → **Mitigation:** The migration should backfill `head_sha = ''` for existing rows, or (safer) delete existing rows if table is known to be empty in all envs. Implementer must verify prod data before applying.
- **Grounding gate false-negatives:** the model may paraphrase file paths slightly (e.g. `src/foo.ts` vs `./src/foo.ts`). → **Mitigation:** Normalise paths to stripped-slash form in `allowedRefs` Set before checking. Drop non-matching entries rather than failing the whole request.
- **`navigator.clipboard` in test env:** jsdom does not implement clipboard. → **Mitigation:** Mock `navigator.clipboard.writeText` in `PrBriefCard.test.tsx` using `vi.stubGlobal`.

## Red-flags check

- [x] Every requirement maps to a task (R1→T6,T7; R2→T6,T7; R3→T5,T6; R4→T5; R5→T5; R6→T10,T11; R7→T6)
- [x] Dependencies form a DAG (no cycles): T1,T2 independent → T3 needs T2 → T4 needs T2,T3 → T5 needs T1 → T6 needs T4,T5 → T7 needs T6 → T8 needs T7; client T9 needs T1, T10 needs T9, T11 needs T10
- [x] Concurrent tasks have non-overlapping Owned paths: T1 and T2 touch different files; T4 and T5 are separate files; T9 and T10 are separate files
- [x] Every Acceptance is measurable: all stated as test commands or observable curl/UI behavior
- [x] No edits to existing shared contracts without explicit callout: T1 explicitly calls out appending to `brief.ts` (or creating `pr-brief.ts`) and the barrel; this is the only shared-contract change
