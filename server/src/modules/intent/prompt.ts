// Pure functions — no DB, no LLM calls here.

// ---------------------------------------------------------------------------
// Prompt assembly logging
// ---------------------------------------------------------------------------

/** Rough token estimate — 1 token ≈ 4 chars. */
function estTokens(chars: number): number {
  return Math.ceil(chars / 4);
}

export interface IntentPromptLog {
  event: 'prompt_assembled';
  kind: 'classifier';
  correlation_id: string;
  model: string;
  provider: string;
  sections: Array<{
    name: string;
    source: string;
    chars: number;
    est_tokens: number;
    present: boolean;
  }>;
  total_system_chars: number;
  total_user_chars: number;
  est_total_tokens: number;
}

/**
 * Build a structured log record for one intent-classifier prompt assembly.
 *
 * Safety contract: all sections here originate from PR data (pr-author /
 * github). None of their content is logged — only char/token counts and whether
 * the section was present. The system prompt is classifier-internal and safe
 * to include as char counts too.
 */
export function buildIntentPromptLog(
  pull: { title: string; body: string | null },
  files: Array<{ path: string; patch?: string | null }>,
  linkedContext: string | null,
  assembled: { system: string; user: string },
  meta: { correlationId: string; model: string; provider: string },
): IntentPromptLog {
  const hunkHeaders = files
    .map(f => f.patch ?? '')
    .join('\n')
    .split('\n')
    .filter(l => l.startsWith('@@'))
    .join('\n');

  const sections: IntentPromptLog['sections'] = [
    {
      name: 'title',
      source: 'pr-author',
      chars: pull.title.length,
      est_tokens: estTokens(pull.title.length),
      present: pull.title.length > 0,
    },
    {
      name: 'description',
      source: 'pr-author',
      chars: pull.body?.length ?? 0,
      est_tokens: estTokens(pull.body?.length ?? 0),
      present: (pull.body?.trim().length ?? 0) > 0,
    },
    {
      name: 'files',
      source: 'github',
      chars: files.reduce((n, f) => n + f.path.length, 0),
      est_tokens: estTokens(files.reduce((n, f) => n + f.path.length, 0)),
      present: files.length > 0,
    },
    {
      name: 'hunk_headers',
      source: 'github',
      chars: hunkHeaders.length,
      est_tokens: estTokens(hunkHeaders.length),
      present: hunkHeaders.length > 0,
    },
    {
      name: 'linked_context',
      source: 'github-issue',
      chars: linkedContext?.length ?? 0,
      est_tokens: estTokens(linkedContext?.length ?? 0),
      present: linkedContext !== null,
    },
  ];

  return {
    event: 'prompt_assembled',
    kind: 'classifier',
    correlation_id: meta.correlationId,
    model: meta.model,
    provider: meta.provider,
    sections,
    total_system_chars: assembled.system.length,
    total_user_chars: assembled.user.length,
    est_total_tokens: estTokens(assembled.system.length + assembled.user.length),
  };
}

/** Strip delimiter sequences that could break XML-style injection guards. */
function sanitize(s: string): string {
  return s.replace(/<\/?untrusted[^>]*>/gi, '');
}

export function extractHunkHeaders(patch: string | null | undefined): string {
  if (!patch) return '';
  return patch
    .split('\n')
    .filter(line => line.startsWith('@@'))
    .join('\n');
}

export function assembleIntentPrompt(
  pull: { title: string; body: string | null },
  files: Array<{ path: string; patch?: string | null }>,
  linkedContext: string | null,
): { system: string; user: string } {
  const safeTitle = sanitize(pull.title);
  const safeBody = pull.body?.trim() ? sanitize(pull.body) : null;

  const fileList = files.map(f => f.path).join('\n');
  const hunkHeaders = files
    .map(f => `${f.path}:\n${extractHunkHeaders(f.patch)}`)
    .filter(s => s.includes('@@'))
    .join('\n\n');

  const system = `You are a PR triage assistant. Extract intent from the pull request WITHOUT reading diff bodies.
Return ONLY a single JSON object matching this exact schema:
{
  "summary": "<one sentence explaining why this PR was opened>",
  "in_scope": ["<what this PR intends to change>"],
  "out_of_scope": ["<explicit exclusions or inferences>"],
  "risk_areas": ["<files or concerns needing deep review>"],
  "confidence": <float 0.0-1.0>,
  "confidence_reason": "<why confidence is below 0.7 if applicable, else empty string>",
  "sources": ["title", "description", "files", "hunk_headers", "linked_context"]
}

Rules:
- If PR description is absent or fewer than 20 words: set confidence below 0.5, set confidence_reason to "description absent, intent inferred from file paths and title only", leave in_scope and out_of_scope empty if not evidenced.
- Do NOT invent scope items not present in the input.
- sources[] must list only the inputs you actually used.
- Output must be valid JSON only. No prose, no markdown fences.`;

  const descriptionSection = safeBody
    ? `## PR Description\n${safeBody}`
    : '## PR Description\n(empty)';

  const linkedSection = linkedContext
    ? `## Linked Context\n${linkedContext}`
    : '';

  const user = [
    `## PR Title\n${safeTitle}`,
    descriptionSection,
    linkedSection,
    `## Changed Files\n${fileList}`,
    hunkHeaders ? `## Hunk Headers\n${hunkHeaders}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  return { system, user };
}
