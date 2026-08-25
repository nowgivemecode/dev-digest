import type { DevDigestClient } from '../http/client.js';

export function pickReview(runs: Array<{ id: string; status: string; ranAt?: string }>): { id: string; status: string } | undefined {
  return runs.filter(r => r.status === 'done').sort((a, b) => (b.ranAt ?? '').localeCompare(a.ranAt ?? ''))[0];
}

export function shapeFindings(trace: { findings?: Array<{ severity?: string; file?: string; line?: number; text?: string }> }): string {
  if (!trace.findings?.length) return 'No findings.';
  return trace.findings.map(f => `[${f.severity ?? 'info'}] ${f.file ?? ''}:${f.line ?? 0} — ${f.text ?? ''}`).join('\n');
}
