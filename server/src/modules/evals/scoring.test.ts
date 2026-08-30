import { describe, it, expect } from 'vitest';
import {
  linesOverlap,
  scoreCase,
  scoreRun,
  type EvalExpectedOutput,
  type ScoringFinding,
} from './scoring.js';

// ─── linesOverlap ─────────────────────────────────────────────────────────────

describe('linesOverlap', () => {
  it('returns true when ranges fully overlap', () => {
    expect(linesOverlap(10, 20, 15, 25)).toBe(true);
  });

  it('returns true when ranges are adjacent within tolerance', () => {
    // range A ends at 10, range B starts at 15 → gap of 5, within default tolerance=5
    expect(linesOverlap(5, 10, 15, 20)).toBe(true);
  });

  it('returns false when ranges do not overlap and gap exceeds tolerance', () => {
    // gap is 6, default tolerance is 5 → should fail
    expect(linesOverlap(1, 5, 12, 20)).toBe(false);
  });

  it('tolerance=5 means line 10 matches expected start_line 15 (single-line ranges)', () => {
    // aEnd=10, bStart=15 → max(10,15)=15, min(10,15)+5=10+5=15 → 15<=15 true
    expect(linesOverlap(10, 10, 15, 15, 5)).toBe(true);
  });

  it('returns true when ranges are identical', () => {
    expect(linesOverlap(42, 50, 42, 50)).toBe(true);
  });
});

// ─── scoreCase ────────────────────────────────────────────────────────────────

describe('scoreCase — must_find', () => {
  const expected: EvalExpectedOutput = {
    type: 'must_find',
    file: 'src/auth.ts',
    start_line: 20,
    end_line: 30,
  };

  it('passes when a finding overlaps the expected range in the same file', () => {
    const findings: ScoringFinding[] = [
      { file: 'src/auth.ts', startLine: 25, endLine: 35 },
    ];
    expect(scoreCase(expected, findings)).toBe(true);
  });

  it('fails when no finding overlaps the range (non-overlapping lines)', () => {
    const findings: ScoringFinding[] = [
      { file: 'src/auth.ts', startLine: 50, endLine: 60 },
    ];
    expect(scoreCase(expected, findings)).toBe(false);
  });

  it('fails when finding is in a different file', () => {
    const findings: ScoringFinding[] = [
      { file: 'src/other.ts', startLine: 25, endLine: 35 },
    ];
    expect(scoreCase(expected, findings)).toBe(false);
  });

  it('fails when findings array is empty', () => {
    expect(scoreCase(expected, [])).toBe(false);
  });

  it('passes when any of multiple findings matches', () => {
    const findings: ScoringFinding[] = [
      { file: 'src/auth.ts', startLine: 100, endLine: 110 }, // no match
      { file: 'src/auth.ts', startLine: 22, endLine: 28 }, // match
    ];
    expect(scoreCase(expected, findings)).toBe(true);
  });
});

describe('scoreCase — must_not_flag', () => {
  const expected: EvalExpectedOutput = {
    type: 'must_not_flag',
    file: 'src/utils.ts',
    start_line: 10,
    end_line: 20,
  };

  it('passes (no false positive) when no finding overlaps', () => {
    const findings: ScoringFinding[] = [
      { file: 'src/utils.ts', startLine: 50, endLine: 60 },
    ];
    expect(scoreCase(expected, findings)).toBe(true);
  });

  it('fails (false positive caught) when a finding overlaps the range', () => {
    const findings: ScoringFinding[] = [
      { file: 'src/utils.ts', startLine: 15, endLine: 25 },
    ];
    expect(scoreCase(expected, findings)).toBe(false);
  });

  it('passes when findings array is empty', () => {
    expect(scoreCase(expected, [])).toBe(true);
  });
});

// ─── scoreRun ─────────────────────────────────────────────────────────────────

describe('scoreRun — recall', () => {
  it('recall = 2/3 when 2 of 3 must_find traces pass', () => {
    const traces = [
      {
        caseId: '1',
        caseName: 'case-1',
        expected: {
          type: 'must_find' as const,
          file: 'a.ts',
          start_line: 10,
          end_line: 20,
        },
        findings: [{ file: 'a.ts', startLine: 15, endLine: 25 }], // pass
      },
      {
        caseId: '2',
        caseName: 'case-2',
        expected: {
          type: 'must_find' as const,
          file: 'b.ts',
          start_line: 10,
          end_line: 20,
        },
        findings: [{ file: 'b.ts', startLine: 30, endLine: 40 }], // fail
      },
      {
        caseId: '3',
        caseName: 'case-3',
        expected: {
          type: 'must_find' as const,
          file: 'c.ts',
          start_line: 1,
          end_line: 5,
        },
        findings: [{ file: 'c.ts', startLine: 1, endLine: 5 }], // pass
      },
    ];

    const metrics = scoreRun(traces);
    expect(metrics.recall).toBeCloseTo(2 / 3);
  });
});

describe('scoreRun — precision', () => {
  it('precision = 0.5 when 1 of 2 must_not_flag cases wrongly flags', () => {
    const traces = [
      {
        caseId: '1',
        caseName: 'no-flag-1',
        expected: {
          type: 'must_not_flag' as const,
          file: 'x.ts',
          start_line: 10,
          end_line: 20,
        },
        findings: [{ file: 'x.ts', startLine: 50, endLine: 60 }], // pass (no false positive)
      },
      {
        caseId: '2',
        caseName: 'no-flag-2',
        expected: {
          type: 'must_not_flag' as const,
          file: 'y.ts',
          start_line: 10,
          end_line: 20,
        },
        findings: [{ file: 'y.ts', startLine: 15, endLine: 25 }], // fail (wrongly flagged)
      },
    ];

    const metrics = scoreRun(traces);
    expect(metrics.precision).toBeCloseTo(0.5);
  });
});

describe('scoreRun — citation_accuracy', () => {
  it('citation_accuracy = 2/3 when 1 of 3 findings has null startLine', () => {
    const traces = [
      {
        caseId: '1',
        caseName: 'case-1',
        expected: { type: 'must_find' as const, file: 'a.ts', start_line: 1 },
        findings: [
          { file: 'a.ts', startLine: 1, endLine: 5 }, // cited
          { file: 'a.ts', startLine: 10, endLine: 15 }, // cited
          { file: 'a.ts', startLine: null, endLine: null }, // not cited
        ],
      },
    ];

    const metrics = scoreRun(traces);
    expect(metrics.citation_accuracy).toBeCloseTo(2 / 3);
  });
});

describe('scoreRun — edge cases', () => {
  it('recall = 1.0 when there are zero must_find traces', () => {
    const traces = [
      {
        caseId: '1',
        caseName: 'no-flag',
        expected: {
          type: 'must_not_flag' as const,
          file: 'a.ts',
          start_line: 1,
        },
        findings: [],
      },
    ];
    const metrics = scoreRun(traces);
    expect(metrics.recall).toBe(1.0);
  });

  it('precision = 1.0 when there are zero must_not_flag traces', () => {
    const traces = [
      {
        caseId: '1',
        caseName: 'find-it',
        expected: {
          type: 'must_find' as const,
          file: 'a.ts',
          start_line: 1,
          end_line: 10,
        },
        findings: [{ file: 'a.ts', startLine: 1, endLine: 10 }],
      },
    ];
    const metrics = scoreRun(traces);
    expect(metrics.precision).toBe(1.0);
  });

  it('citation_accuracy = 1.0 when there are no findings at all', () => {
    const traces = [
      {
        caseId: '1',
        caseName: 'empty',
        expected: { type: 'must_find' as const, file: 'a.ts', start_line: 1 },
        findings: [],
      },
    ];
    const metrics = scoreRun(traces);
    expect(metrics.citation_accuracy).toBe(1.0);
  });

  it('returns empty per_trace and correct totals for empty traces array', () => {
    const metrics = scoreRun([]);
    expect(metrics.per_trace).toHaveLength(0);
    expect(metrics.traces_total).toBe(0);
    expect(metrics.traces_passed).toBe(0);
    expect(metrics.recall).toBe(1.0);
    expect(metrics.precision).toBe(1.0);
    expect(metrics.citation_accuracy).toBe(1.0);
  });

  it('traces_passed counts correctly across mixed trace types', () => {
    const traces = [
      {
        caseId: '1',
        caseName: 'found',
        expected: {
          type: 'must_find' as const,
          file: 'a.ts',
          start_line: 1,
          end_line: 10,
        },
        findings: [{ file: 'a.ts', startLine: 5, endLine: 8 }], // pass
      },
      {
        caseId: '2',
        caseName: 'not-found',
        expected: {
          type: 'must_find' as const,
          file: 'b.ts',
          start_line: 1,
          end_line: 10,
        },
        findings: [], // fail
      },
    ];
    const metrics = scoreRun(traces);
    expect(metrics.traces_passed).toBe(1);
    expect(metrics.traces_total).toBe(2);
  });
});

describe('scoreCase — null startLine handling', () => {
  it('treats a finding with null startLine as line 0 (unlikely to match a real range)', () => {
    const expected: EvalExpectedOutput = {
      type: 'must_find',
      file: 'a.ts',
      start_line: 50,
      end_line: 60,
    };
    // startLine null → treated as 0, endLine null → 0; range [0,0] vs [50,60]
    // gap is 50, with tolerance 5 → 0 <= 0+5=5 < 50 → no overlap
    const findings: ScoringFinding[] = [{ file: 'a.ts', startLine: null, endLine: null }];
    expect(scoreCase(expected, findings)).toBe(false);
  });
});
