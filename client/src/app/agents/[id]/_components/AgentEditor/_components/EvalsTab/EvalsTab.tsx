"use client";

import React, { useState } from "react";
import { useEvalCases, useEvalRuns, useRunAllEvals } from "@/lib/hooks/evals";
import { EvalCaseRow } from "./EvalCaseRow";
import { EvalCaseModal } from "./EvalCaseModal";
import type { EvalCase } from "@devdigest/shared";

export function EvalsTab({ agentId }: { agentId: string }) {
  const [selectedCase, setSelectedCase] = useState<EvalCase | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);

  const { data: cases = [], isLoading: casesLoading } = useEvalCases(agentId);
  const { data: runs = [] } = useEvalRuns(agentId);
  const runAll = useRunAllEvals(agentId);

  // Compute metrics from latest run (runs[0] if exists)
  const latestRun = runs[0];
  const prevRun = runs[1];
  const recall = latestRun?.recall ?? null;
  const precision = latestRun?.precision ?? null;
  const citationAcc = latestRun?.citation_accuracy ?? null;

  // Delta: current - previous (in percentage points)
  const recallDelta =
    recall != null && prevRun?.recall != null
      ? (recall - prevRun.recall) * 100
      : null;
  const precDelta =
    precision != null && prevRun?.precision != null
      ? (precision - prevRun.precision) * 100
      : null;
  const citDelta =
    citationAcc != null && prevRun?.citation_accuracy != null
      ? (citationAcc - prevRun.citation_accuracy) * 100
      : null;

  // traces_passed / traces_total from latest run's per_trace
  const perTrace = (latestRun?.actual_output as any)?.per_trace as
    | Array<{ pass: boolean }>
    | undefined;
  const tracesPassed = perTrace ? perTrace.filter((t) => t.pass).length : null;
  const tracesTotal = perTrace ? perTrace.length : null;

  return (
    <div style={{ padding: "24px" }}>
      {/* Metrics row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", gap: 32 }}>
          <MetricChip label="RECALL" value={recall} delta={recallDelta} />
          <MetricChip label="PRECISION" value={precision} delta={precDelta} />
          <MetricChip
            label="CITATION ACCURACY"
            value={citationAcc}
            delta={citDelta}
          />
          {tracesPassed != null && (
            <MetricChip
              label="TRACES PASSED"
              value={null}
              raw={`${tracesPassed}/${tracesTotal}`}
            />
          )}
        </div>
        <a
          href={`/evals/${agentId}`}
          style={{ fontSize: 13, color: "var(--accent)" }}
        >
          View full dashboard →
        </a>
      </div>

      {/* Action row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button
          onClick={() => runAll.mutate()}
          disabled={runAll.isPending || cases.length === 0}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            cursor:
              runAll.isPending || cases.length === 0 ? "not-allowed" : "pointer",
            background: "var(--accent, #4f6ef7)",
            color: "#fff",
            fontSize: 13,
          }}
        >
          {runAll.isPending ? "Running…" : "Run all evals"}
        </button>
        <button
          onClick={() => setShowNewModal(true)}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            cursor: "pointer",
            background: "var(--bg-surface)",
            fontSize: 13,
          }}
        >
          + New eval case
        </button>
      </div>

      {/* Cases list */}
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "var(--text-muted)",
          marginBottom: 8,
        }}
      >
        EVAL CASES {cases.length > 0 ? `${cases.length} cases` : ""}
      </div>
      {casesLoading ? (
        <div>Loading…</div>
      ) : cases.length === 0 ? (
        <div style={{ color: "var(--text-muted)", fontSize: 14 }}>
          No eval cases yet. Create one from a finding or click "New eval case".
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {cases.map((c) => (
            <EvalCaseRow
              key={c.id}
              evalCase={c}
              agentId={agentId}
              onClick={() => setSelectedCase(c)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {(selectedCase || showNewModal) && (
        <EvalCaseModal
          evalCase={selectedCase ?? undefined}
          agentId={agentId}
          onClose={() => {
            setSelectedCase(null);
            setShowNewModal(false);
          }}
        />
      )}
    </div>
  );
}

function MetricChip({
  label,
  value,
  delta,
  raw,
}: {
  label: string;
  value: number | null;
  delta?: number | null;
  raw?: string;
}) {
  const pct = value != null ? Math.round(value * 100) : null;
  const deltaStr =
    delta != null
      ? `${delta >= 0 ? "+" : ""}${delta.toFixed(0)}pt`
      : null;
  const deltaColor =
    delta == null
      ? undefined
      : delta >= 0
        ? "var(--success)"
        : "var(--error, #e53)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "var(--text-muted)",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: 24, fontWeight: 700 }}>
          {raw ?? (pct != null ? `${pct}%` : "—")}
        </span>
        {deltaStr && (
          <span style={{ fontSize: 12, color: deltaColor }}>{deltaStr}</span>
        )}
      </div>
    </div>
  );
}
