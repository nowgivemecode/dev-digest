"use client";
import React, { useState } from "react";
import { useParams } from "next/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useEvalRuns } from "@/lib/hooks/evals";
import { RunsTable } from "../_components/RunsTable";
import type { EvalRunRecord } from "@devdigest/shared";

export default function AgentEvalPage() {
  const params = useParams();
  const agentId = params?.agentId as string;
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);

  const { data: runs = [], isLoading } = useEvalRuns(agentId);

  // Trend chart data — reverse so oldest first
  const trendData = [...runs]
    .reverse()
    .map((r) => ({
      date: new Date(r.ran_at).toLocaleDateString(),
      recall: r.recall != null ? Math.round(r.recall * 100) : null,
      precision: r.precision != null ? Math.round(r.precision * 100) : null,
      citation:
        r.citation_accuracy != null ? Math.round(r.citation_accuracy * 100) : null,
    }))
    .filter((d) => d.recall != null || d.precision != null);

  const latestRun = runs[0];
  const prevRun = runs[1];

  function toggleSelect(id: string) {
    setSelectedRunIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < 2
        ? [...prev, id]
        : [prev[1], id],
    );
  }

  const [runA, runB] = selectedRunIds.map((id) => runs.find((r) => r.id === id));

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1100 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Agent Evals</h1>
          <p style={{ color: "var(--text-muted)", marginTop: 4, fontSize: 14 }}>
            Regression harness: {runs.length} run(s)
          </p>
        </div>
      </div>

      {/* Alert if precision dipped */}
      {latestRun?.precision != null &&
        prevRun?.precision != null &&
        latestRun.precision < prevRun.precision && (
          <div
            style={{
              padding: "10px 16px",
              borderRadius: 6,
              marginBottom: 20,
              background: "rgba(255,165,0,0.12)",
              border: "1px solid rgba(255,165,0,0.4)",
              color: "orange",
              fontSize: 13,
            }}
          >
            ⚠ Precision dipped{" "}
            {Math.round((prevRun.precision - latestRun.precision) * 100)}pts in the latest
            run — a new false positive may have slipped in.
          </div>
        )}

      {/* Metric cards */}
      <div style={{ display: "flex", gap: 24, marginBottom: 32, flexWrap: "wrap" }}>
        {[
          { label: "RECALL", cur: latestRun?.recall, prev: prevRun?.recall },
          { label: "PRECISION", cur: latestRun?.precision, prev: prevRun?.precision },
          {
            label: "CITATION ACCURACY",
            cur: latestRun?.citation_accuracy,
            prev: prevRun?.citation_accuracy,
          },
        ].map(({ label, cur, prev }) => {
          const pct = cur != null ? Math.round(cur * 100) : null;
          const delta =
            cur != null && prev != null ? Math.round((cur - prev) * 100) : null;
          return (
            <div
              key={label}
              style={{
                padding: "16px 20px",
                border: "1px solid var(--border)",
                borderRadius: 8,
                minWidth: 160,
              }}
            >
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
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 28, fontWeight: 700 }}>
                  {pct != null ? `${pct}%` : "—"}
                </span>
                {delta != null && (
                  <span style={{ fontSize: 12, color: delta >= 0 ? "#0a0" : "#e53" }}>
                    {delta >= 0 ? "+" : ""}
                    {delta}pt
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Trend chart */}
      {trendData.length > 1 && (
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--text-muted)",
              marginBottom: 12,
              letterSpacing: "0.06em",
            }}
          >
            METRIC TREND
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="recall"
                stroke="#4f6ef7"
                dot={false}
                name="Recall"
              />
              <Line
                type="monotone"
                dataKey="precision"
                stroke="#f7c04f"
                dot={false}
                name="Precision"
              />
              <Line
                type="monotone"
                dataKey="citation"
                stroke="#4fc97f"
                dot={false}
                name="Citation"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent runs table */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--text-muted)",
              letterSpacing: "0.06em",
            }}
          >
            RECENT RUNS
          </div>
          <button
            onClick={() => setShowCompare(true)}
            disabled={selectedRunIds.length !== 2}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              cursor: selectedRunIds.length === 2 ? "pointer" : "default",
              opacity: selectedRunIds.length === 2 ? 1 : 0.4,
              background: "var(--bg-surface)",
            }}
          >
            Compare
          </button>
        </div>
        {isLoading ? (
          <div>Loading…</div>
        ) : (
          <RunsTable
            runs={runs}
            selectable
            selectedIds={selectedRunIds}
            onToggleSelect={toggleSelect}
          />
        )}
      </div>

      {/* Compare modal */}
      {showCompare && runA != null && runB != null && (
        <CompareModal
          runA={runA}
          runB={runB}
          agentId={agentId}
          onClose={() => setShowCompare(false)}
        />
      )}
    </div>
  );
}

function CompareModal({
  runA,
  runB,
  agentId,
  onClose,
}: {
  runA: EvalRunRecord;
  runB: EvalRunRecord;
  agentId: string;
  onClose: () => void;
}) {
  const metrics: Array<{
    label: string;
    a: number | null;
    b: number | null;
    isCost?: boolean;
  }> = [
    { label: "RECALL", a: runA.recall, b: runB.recall },
    { label: "PRECISION", a: runA.precision, b: runB.precision },
    { label: "CITATION", a: runA.citation_accuracy, b: runB.citation_accuracy },
    { label: "COST", a: runA.cost_usd, b: runB.cost_usd, isCost: true },
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "var(--bg-primary)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          width: "min(700px, 95vw)",
          maxHeight: "85vh",
          overflow: "auto",
          padding: 32,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Compare runs</h2>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20 }}
          >
            ×
          </button>
        </div>

        {/* Metric deltas */}
        <div style={{ display: "flex", gap: 24, marginBottom: 24, flexWrap: "wrap" }}>
          {metrics.map(({ label, a, b, isCost }) => {
            if (a == null || b == null) return null;
            const delta = b - a;
            const deltaStr = isCost
              ? `${delta >= 0 ? "+" : ""}$${Math.abs(delta).toFixed(2)}`
              : `${delta >= 0 ? "+" : ""}${Math.round(delta * 100)}pt`;
            const bStr = isCost ? `$${b.toFixed(2)}` : `${Math.round(b * 100)}%`;
            return (
              <div key={label} style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    marginBottom: 4,
                  }}
                >
                  {label}
                </div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{bStr}</div>
                <div style={{ fontSize: 12, color: delta >= 0 ? "#0a0" : "#e53" }}>
                  {deltaStr}
                </div>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 24 }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              cursor: "pointer",
              background: "var(--bg-surface)",
            }}
          >
            Close
          </button>
          <a
            href={`/agents/${agentId}?tab=config`}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              background: "var(--accent, #4f6ef7)",
              color: "#fff",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Go to agent config
          </a>
        </div>
      </div>
    </div>
  );
}
