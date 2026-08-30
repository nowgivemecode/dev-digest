# Feature Spec: PR Why + Risk Brief

## Status
Draft

## Purpose
Reviewers opening a pull request must mentally reconstruct *what changed, why it matters, and what could break* before they can review effectively. Today this requires reading the PR description, tracing the blast map, and scanning the intent output manually. The Brief feature distils those signals into a single structured card — `what`, `why`, `risk_level`, and grounded `risks[]` + `review_focus[]` — so a reviewer reaches readiness in one glance without reading any diff body lines.

## Goals

- **G1:** Expose `POST /pulls/:id/brief` that collects pre-existing intent and blast data (no diff hunk bodies), calls the LLM once, and returns a `Brief` object within a total prompt budget of 8,000 tokens.
- **G2:** Cache the brief per PR commit SHA (`head_sha`); a second request for the same SHA returns the cached value without an LLM call.
- **G3:** Expose `POST /pulls/:id/brief/recompute` that forces a fresh LLM call regardless of cache state.
- **G4:** Every `risks[].file_refs` entry and every `review_focus[]` item must reference a file path or endpoint that appears in the blast map or changed-file list supplied to the model.
- **G5:** Render a `PrBriefCard` UI component on the Overview tab that shows the risk level badge and a clickable `review_focus` list.

## Non-goals

- **NG1:** Sending diff hunk body lines (added/removed code) to the model — only file paths, hunk `@@` headers, diff stats, and structured metadata are permitted.
- **NG2:** Automatically triggering the brief on PR open; it is always user-initiated (explicit button click or API call).
- **NG3:** Displaying the full blast callers graph or intent scope lists inside `PrBriefCard` — those are rendered by their own cards.
- **NG4:** Persisting `review_focus` clicks or tracking which focus items a reviewer has visited.
- **NG5:** Cost attribution or token-usage metrics surfaced in the UI for this feature (logging is sufficient for server-side observability).
- **NG6:** Modifying the intent module (`modules/intent/`) or the blast radius module (`container.repoIntel.getBlastRadius`) — both are consumed read-only.

## Inputs & provenance

| Input | Source | Notes |
|-------|--------|-------|
| `intent.intent` | `GET /pulls/:id/intent` → `pr_intent` DB table (upserted by IntentService) | String, always present after intent is computed |
| `intent.in_scope[]` | Same as above | String array |
| `intent.out_of_scope[]` | Same as above | String array |
| `blast.changedSymbols[]` | `container.repoIntel.getBlastRadius(repoId, changedFilePaths)` → `BlastResult` | May be empty when index is degraded |
| `blast.callers[]` | Same `BlastResult` | May be empty |
| `blast.impactedEndpoints[]` | Same `BlastResult` | Flat string array, e.g. `"GET /users/:id"` |
| `pr.head_sha` | `pull_requests.head_sha` (DB column, set on sync from GitHub) | Used as cache key |
| `pr.additions` | `pull_requests.additions` (DB column) | Integer |
| `pr.deletions` | `pull_requests.deletions` (DB column) | Integer |
| `pr.files_count` | `pull_requests.files_count` (DB column) | Integer |
| `pr.title` | `pull_requests.title` | String |
| `pr.body` | `pull_requests.body` | Nullable string; omitted from prompt when null/empty |
| `pr.files[].path` | `pr_files.path` (DB table) | Changed file paths only — no patch bodies |
| `pr.files[].additions` | `pr_files.additions` | Integer |
| `pr.files[].deletions` | `pr_files.deletions` | Integer |
| `linked_issue` | `pull_requests.body` → parsed GitHub issue reference, fetched via `GitHubClient.getIssue` | Best-effort; null when no issue linked or GitHub unavailable |
| Relevant specs | `references.ts` from intent module (already resolved during intent computation) | Re-used from persisted intent result; not re-fetched |

**Spec budget note:** References/specs are NOT re-fetched at brief time. The intent summary (already computed) provides a condensed representation. The 8,000-token budget covers: intent block (~200 tokens), blast summary block (~400 tokens), file list with stats (~200 tokens per 10 files, capped at 60 files → max ~1,200 tokens), linked issue (~300 tokens), PR title + body (truncated at 1,000 chars → ~250 tokens), system prompt (~500 tokens). Total estimated maximum: ~2,850 tokens, well within the 8,000-token hard cap.

## Output schema

```typescript
/** Returned by POST /pulls/:id/brief and POST /pulls/:id/brief/recompute */
interface Brief {
  /** One sentence: what this PR changes at a technical level. */
  what: string;
  /** One sentence: why the change is needed (user problem or business driver). */
  why: string;
  /** Aggregate risk level for merging this PR. */
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  /** Ordered list of risks, highest severity first. */
  risks: Risk[];
  /** Ordered list of areas a reviewer should focus on, grounded in real files/endpoints. */
  review_focus: string[];
}

interface Risk {
  /** Short label, e.g. "Breaking API change" */
  title: string;
  /** One-sentence explanation of why this is risky. */
  explanation: string;
  /** Severity of this individual risk. */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /**
   * File paths or endpoint strings from the blast map or changed-file list.
   * Must reference only files/endpoints present in the model input.
   * Empty array is valid when the risk is cross-cutting.
   */
  file_refs: string[];
}

/** Wire response from GET /pulls/:id/brief (cache read) — same shape plus cache metadata */
interface BriefRecord extends Brief {
  pr_id: string;
  /** The commit SHA this brief was computed against. */
  head_sha: string;
  /** ISO 8601 timestamp of when this brief was last computed. */
  computed_at: string;
}
```

## Acceptance criteria

- **AC-01** — When `POST /pulls/:id/brief` is called and no cached brief exists for the PR's current `head_sha`, the system shall compute a `Brief` via one LLM call, persist it keyed by `(pr_id, head_sha)`, and return the `BriefRecord`.
- **AC-02** — When `POST /pulls/:id/brief` is called and a cached brief exists for the PR's current `head_sha`, the system shall return the cached `BriefRecord` without making an LLM call.
- **AC-03** — When `POST /pulls/:id/brief/recompute` is called, the system shall compute a fresh `Brief` via one LLM call regardless of any cached brief, overwrite the cache for the current `head_sha`, and return the updated `BriefRecord`.
- **AC-04** — The system shall construct the LLM prompt using only: PR title, PR body (truncated to 1,000 characters), intent summary + in_scope + out_of_scope, blast `changedSymbols`, `callers`, and `impactedEndpoints`, changed file paths with additions/deletions (no patch bodies), and the linked issue title+body when present.
- **AC-05** — The system shall enforce a hard token budget of 8,000 tokens on the assembled prompt; if the budget would be exceeded, the system shall truncate the file list (keeping the most-changed files) and the linked issue body (keeping the first 500 characters) before truncating other fields.
- **AC-06** — Every entry in `risks[].file_refs` shall reference a file path present in the changed-file list or an endpoint string present in `blast.impactedEndpoints` that was included in the model prompt.
- **AC-07** — Every entry in `review_focus[]` shall reference a real file path or endpoint that was included in the model prompt, not a paraphrase or inferred entity.
- **AC-08** — The system shall use the `risk_brief` feature-model slot (provider + model) configured in workspace settings, defaulting to `openai / gpt-4.1`.
- **AC-09** — The `PrBriefCard` component shall display the `risk_level` as a coloured badge (`low` → green, `medium` → yellow, `high` → orange, `critical` → red).
- **AC-10** — The `PrBriefCard` component shall render `review_focus[]` as a clickable list; clicking an item shall copy the file path or endpoint string to the clipboard.
- **AC-11** — While the brief is loading (first compute or recompute in progress), `PrBriefCard` shall display a skeleton placeholder.
- **AC-12** — When `POST /pulls/:id/brief` is called and the PR does not exist in the workspace, the system shall return HTTP 404.
- **AC-13** — The system shall rate-limit `POST /pulls/:id/brief/recompute` to at most 10 calls per minute per workspace (consistent with `POST /pulls/:id/intent/recompute`).

## Error & degraded states

- **ERR-01** — If the intent has not yet been computed for the PR, then the system shall compute it inline (reusing `IntentService.getOrCompute`) before building the brief prompt, with no additional error returned to the caller.
- **ERR-02** — If `container.repoIntel.getBlastRadius` returns a degraded result (empty `changedSymbols` and `callers`), then the system shall proceed with an empty blast section in the prompt; the `Brief` shall still be generated with reduced accuracy and `risks[]` grounded only in the file list and intent.
- **ERR-03** — If the GitHub client is unavailable (no PAT configured), then the system shall omit the linked issue section from the prompt and proceed with the remaining inputs.
- **ERR-04** — If the LLM call fails (provider error, timeout, or schema validation failure), then the system shall return HTTP 502 with error code `brief_llm_error` and not persist a partial result.
- **ERR-05** — If the assembled prompt exceeds 8,000 tokens after all truncation steps have been applied, then the system shall log a warning and proceed with the truncated input rather than failing the request.
- **ERR-06** — If `PrBriefCard` receives an API error, then it shall display an inline error message with a "Try again" button that retriggers the `POST /pulls/:id/brief` call.

## Non-functional constraints

- **NF-01** — **Token budget:** The assembled LLM prompt (system + user messages combined) shall not exceed 8,000 tokens. Truncation priority: (1) linked issue body → 500 chars max, (2) file list → 60 files max, most-changed first, (3) PR body → 1,000 chars max, (4) blast callers → 50 callers max.
- **NF-02** — **Caching:** The brief is cached per `(pr_id, head_sha)` in the `pr_brief` DB table. The table requires a `head_sha` column (text, not null) to be added alongside the existing `json` column. A unique index on `(pr_id, head_sha)` is required; a new push with a different `head_sha` inserts a new row (old rows are NOT purged automatically in this version).
- **NF-03** — **Latency:** The `POST /pulls/:id/brief` endpoint (cache miss path) shall complete within 30 seconds under normal load. No SSE streaming is required; the response is synchronous.
- **NF-04** — **Rate limiting:** `POST /pulls/:id/brief/recompute` is rate-limited to 10 requests per minute per workspace. `POST /pulls/:id/brief` (compute-if-absent) is exempt from this rate limit since cache hits are free.
- **NF-05** — **Security:** PR body, issue body, and spec references included in the prompt shall be wrapped with `wrapUntrusted` (same pattern as `classifier.ts`) before injection into the user message.
- **NF-06** — **Feature model:** The `risk_brief` feature-model slot already exists in `FeatureModelId` (`server/src/vendor/shared/contracts/platform.ts`) with default `openai / gpt-4.1`. No new settings plumbing is required.
- **NF-07** — **No diff bodies:** Patch text (`pr_files.patch`) shall never be included in the brief prompt. Only `path`, `additions`, and `deletions` are sent per file.

## Open questions

None. All items resolved by decision below.

## Decisions log

| Category | Decision |
|----------|----------|
| Token budget | 8,000 tokens hard cap; truncation priority: issue body → file count → PR body → blast callers |
| Cache key | `(pr_id, head_sha)` — head_sha column added to `pr_brief` table |
| Blast source | `container.repoIntel.getBlastRadius` (facade); degraded result → empty blast section, not an error |
| Intent source | `IntentService.getOrCompute` — compute inline if missing, no error surfaced to caller |
| Linked issue | Best-effort via parsed PR body references + GitHub client; omitted when unavailable |
| Specs in prompt | Not re-fetched; intent summary already encodes the intent. Specs are NG. |
| review_focus click action | Copy to clipboard (simple, no navigation side-effects) |
| Old brief rows | Not auto-purged; planner can add a cleanup job later |
| Latency contract | 30s synchronous response; no SSE needed |

## Provenance

- `intent` → `pr_intent` DB table, keyed by `pr_id`; populated by `IntentService` via `GET /pulls/:id/intent`
- `blast` → `container.repoIntel.getBlastRadius(repoId, changedFilePaths)` from `RepoIntel` facade (`server/src/modules/repo-intel/types.ts`); reads from `symbols`, `references`, `file_facts` DB tables
- `pr.*` fields → `pull_requests` DB table (`server/src/db/schema/pulls.ts`)
- `pr.files[]` → `pr_files` DB table (`server/src/db/schema/pulls.ts`)
- `linked_issue` → GitHub API via `GitHubClient.getIssue`, reference parsed from `pull_requests.body`
- Brief cache storage → `pr_brief` DB table (`server/src/db/schema/reviews.ts`); needs `head_sha` column added
- Feature model → `settings` DB table via `resolveFeatureModel(container, workspaceId, 'risk_brief')`; `FeatureModelId` enum in `server/src/vendor/shared/contracts/platform.ts`
