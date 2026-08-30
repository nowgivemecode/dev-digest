"use client";
import React from "react";
import type { EvalRunRecord } from "@devdigest/shared";

function MetricBar({ value }: { value: number | null }) {
  if (value == null) return <span style={{ color: "var(--text-muted)" }}>—</span>;
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? "#0a0" : pct >= 60 ? "orange" : "#e53";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 60, height: 6, background: "var(--border)", borderRadius: 3 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 12, minWidth: 30 }}>{pct}%</span>
    </div>
  );
}

export function RunsTable({
  runs,
  showAgentLink = false,
  selectable = false,
  selectedIds = [],
  onToggleSelect,
}: {
  runs: EvalRunRecord[];
  showAgentLink?: boolean;
  selectable?: boolean;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
}) {
  if (runs.length === 0) {
    return <div style={{ color: "var(--text-muted)", fontSize: 14 }}>No eval runs yet.</div>;
  }

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr style={{ borderBottom: "1px solid var(--border)" }}>
          {selectable && <th style={{ width: 32, padding: "8px" }} />}
          <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-muted)", fontWeight: 600 }}>CASE</th>
          <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-muted)", fontWeight: 600 }}>RAN AT</th>
          <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-muted)", fontWeight: 600 }}>RECALL</th>
          <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-muted)", fontWeight: 600 }}>PRECISION</th>
          <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-muted)", fontWeight: 600 }}>CITATION</th>
          <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-muted)", fontWeight: 600 }}>PASS</th>
          <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-muted)", fontWeight: 600 }}>COST</th>
        </tr>
      </thead>
      <tbody>
        {runs.map((run) => {
          const date = new Date(run.ran_at).toLocaleString();
          const perTrace = (run.actual_output as { per_trace?: Array<{ pass: boolean }> } | null)?.per_trace;
          const passed = perTrace ? perTrace.filter((t) => t.pass).length : null;
          const total = perTrace ? perTrace.length : null;

          return (
            <tr key={run.id} style={{ borderBottom: "1px solid var(--border)" }}>
              {selectable && (
                <td style={{ padding: "10px 12px" }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(run.id)}
                    onChange={() => onToggleSelect?.(run.id)}
                  />
                </td>
              )}
              <td style={{ padding: "10px 12px", fontWeight: 500 }}>{run.case_name ?? "—"}</td>
              <td style={{ padding: "10px 12px", color: "var(--text-muted)" }}>{date}</td>
              <td style={{ padding: "10px 12px" }}><MetricBar value={run.recall} /></td>
              <td style={{ padding: "10px 12px" }}><MetricBar value={run.precision} /></td>
              <td style={{ padding: "10px 12px" }}><MetricBar value={run.citation_accuracy} /></td>
              <td style={{ padding: "10px 12px" }}>
                {passed != null && total != null
                  ? `${passed}/${total}`
                  : run.pass == null
                  ? "—"
                  : run.pass
                  ? "✓"
                  : "✗"}
              </td>
              <td style={{ padding: "10px 12px" }}>
                {run.cost_usd != null ? `$${run.cost_usd.toFixed(2)}` : "—"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
