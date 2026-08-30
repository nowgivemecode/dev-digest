/**
 * scoring.ts — Pure scoring functions for the eval pipeline.
 *
 * Zero imports from DB, LLM adapters, or any async module.
 * Importable with no side effects.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Expected output stored in eval_cases.expected_output jsonb */
export type EvalExpectedOutput =
  | {
      type: 'must_find';
      file: string;
      start_line: number;
      end_line?: number;
      severity?: string;
      title?: string;
    }
  | {
      type: 'must_not_flag';
      file: string;
      start_line: number;
      end_line?: number;
    };

/** A minimal finding shape for scoring (subset of the full Finding type) */
export interface ScoringFinding {
  file: string;
  startLine: number | null;
  endLine: number | null;
}

export interface EvalRunMetrics {
  recall: number; // 0..1
  precision: number; // 0..1
  citation_accuracy: number; // 0..1
  traces_passed: number;
  traces_total: number;
  per_trace: Array<{ name: string; pass: boolean; expected: unknown; actual: unknown }>;
}

// ─── Core helpers ─────────────────────────────────────────────────────────────

/**
 * Returns true if line ranges [aStart, aEnd] and [bStart, bEnd] overlap
 * (with tolerance). If aEnd / bEnd is null/undefined, the single-line
 * value (aStart / bStart) is used for that bound.
 *
 * Overlap condition: max(aStart, bStart) <= min(aEnd, bEnd) + tolerance
 */
export function linesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
  tolerance = 5,
): boolean {
  const lo = Math.max(aStart, bStart);
  const hi = Math.min(aEnd, bEnd) + tolerance;
  return lo <= hi;
}

/**
 * Returns true if any finding in `findings` matches the expected output.
 *
 * - must_find  → passes if ANY finding matches: same file AND lines overlap
 * - must_not_flag → passes if NO finding matches: same file AND lines overlap
 */
export function scoreCase(
  expected: EvalExpectedOutput,
  findings: ScoringFinding[],
): boolean {
  const expectedEnd = expected.end_line ?? expected.start_line;

  const hasMatch = findings.some((f) => {
    if (f.file !== expected.file) return false;

    const fStart = f.startLine ?? 0;
    const fEnd = f.endLine ?? fStart;

    return linesOverlap(fStart, fEnd, expected.start_line, expectedEnd);
  });

  if (expected.type === 'must_find') {
    return hasMatch;
  }
  // must_not_flag
  return !hasMatch;
}

// ─── Run-level scoring ────────────────────────────────────────────────────────

/**
 * Scores a complete eval run.
 *
 * Recall    = passed_must_find    / total_must_find    (1.0 if no must_find cases)
 * Precision = passed_must_not_flag/ total_must_not_flag (1.0 if no must_not_flag cases)
 * Citation accuracy = findings_with_non_null_startLine / total_findings
 *                     across all traces (1.0 if no findings)
 */
export function scoreRun(
  traces: Array<{
    caseId: string;
    caseName: string;
    expected: EvalExpectedOutput;
    findings: ScoringFinding[];
  }>,
): EvalRunMetrics {
  // Per-trace results
  const perTrace = traces.map((t) => {
    const pass = scoreCase(t.expected, t.findings);
    return {
      name: t.caseName,
      pass,
      expected: t.expected,
      actual: t.findings,
    };
  });

  const mustFindTraces = traces.filter((t) => t.expected.type === 'must_find');
  const mustNotFlagTraces = traces.filter(
    (t) => t.expected.type === 'must_not_flag',
  );

  const passedMustFind = mustFindTraces.filter((t) =>
    scoreCase(t.expected, t.findings),
  ).length;

  const passedMustNotFlag = mustNotFlagTraces.filter((t) =>
    scoreCase(t.expected, t.findings),
  ).length;

  const recall =
    mustFindTraces.length === 0 ? 1.0 : passedMustFind / mustFindTraces.length;

  const precision =
    mustNotFlagTraces.length === 0
      ? 1.0
      : passedMustNotFlag / mustNotFlagTraces.length;

  // Citation accuracy: across all findings in all traces
  const allFindings = traces.flatMap((t) => t.findings);
  const citationAccuracy =
    allFindings.length === 0
      ? 1.0
      : allFindings.filter((f) => f.startLine !== null).length / allFindings.length;

  const tracesPassed = perTrace.filter((t) => t.pass).length;

  return {
    recall,
    precision,
    citation_accuracy: citationAccuracy,
    traces_passed: tracesPassed,
    traces_total: traces.length,
    per_trace: perTrace,
  };
}
