"use client";
import React from "react";
import Link from "next/link";
import { useEvalDashboard } from "@/lib/hooks/evals";
import { useAgents } from "@/lib/hooks/agents";
import { RunsTable } from "./_components/RunsTable";

export default function EvalDashboardPage() {
  const { data: dashboard, isLoading } = useEvalDashboard();
  const { data: agents, isLoading: agentsLoading } = useAgents();
  const [runAllToast, setRunAllToast] = React.useState(false);

  function handleRunAll() {
    setRunAllToast(true);
    setTimeout(() => setRunAllToast(false), 3000);
  }

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1100 }}>
      {runAllToast && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            padding: "10px 18px",
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 13,
            zIndex: 9999,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          Run all evals per agent — trigger from each agent's eval tab.
        </div>
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 32,
        }}
      >
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Eval Dashboard</h1>
          <p style={{ color: "var(--text-muted)", marginTop: 6 }}>
            Regression harness across all reviewed agents — pick an agent to see its runs
          </p>
        </div>
        <button
          onClick={handleRunAll}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--bg-surface)",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-secondary)",
          }}
        >
          Run all agents
        </button>
      </div>

      {/* Summary metrics */}
      {dashboard && (
        <div style={{ display: "flex", gap: 24, marginBottom: 32, flexWrap: "wrap" }}>
          <MetricCard
            label="RECALL"
            value={dashboard.current.recall}
            delta={dashboard.delta.recall}
          />
          <MetricCard
            label="PRECISION"
            value={dashboard.current.precision}
            delta={dashboard.delta.precision}
          />
          <MetricCard
            label="CITATION"
            value={dashboard.current.citation_accuracy}
            delta={dashboard.delta.citation_accuracy}
          />
          <div
            style={{
              padding: "16px 20px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              minWidth: 120,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>
              TOTAL CASES
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>
              {dashboard.cases_total}
            </div>
          </div>
        </div>
      )}

      {/* Alert banner (if present) */}
      {dashboard?.alert && (
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
          ⚠ {dashboard.alert}
        </div>
      )}

      {/* AGENTS section */}
      <div style={{ marginBottom: 40 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "var(--text-muted)",
            marginBottom: 12,
            letterSpacing: "0.06em",
          }}
        >
          AGENTS
        </div>
        {agentsLoading && (
          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading agents…</div>
        )}
        {!agentsLoading && (!agents || agents.length === 0) && (
          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
            No agents yet.{" "}
            <Link href="/agents" style={{ color: "var(--accent, #4f6ef7)" }}>
              Create an agent
            </Link>{" "}
            to start running evals.
          </div>
        )}
        {agents && agents.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {agents.map((agent, idx) => {
              const agentRuns = dashboard?.recent_runs?.filter(
                (r) => dashboard.owner_id === agent.id,
              );
              const runCount = agentRuns?.length ?? 0;
              const isFirst = idx === 0;
              const isLast = idx === agents.length - 1;
              return (
                <Link
                  key={agent.id}
                  href={`/evals/${agent.id}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      padding: "14px 18px",
                      border: "1px solid var(--border)",
                      borderRadius: isFirst && isLast ? 8 : isFirst ? "8px 8px 0 0" : isLast ? "0 0 8px 8px" : 0,
                      borderTop: isFirst ? undefined : "none",
                      background: "var(--bg-surface)",
                      cursor: "pointer",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background =
                        "var(--bg-hover, rgba(79,110,247,0.05))";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background =
                        "var(--bg-surface)";
                    }}
                  >
                    {/* Agent name + version */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{agent.name}</span>
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 12,
                          color: "var(--text-muted)",
                        }}
                      >
                        v{agent.version} · {runCount} run{runCount !== 1 ? "s" : ""}
                      </span>
                    </div>

                    {/* Metrics — show from workspace dashboard current if this is the
                        aggregate owner, otherwise show dashes (per-agent fetch
                        would require new API call — keeping it simple) */}
                    <div style={{ display: "flex", gap: 20, fontSize: 12 }}>
                      <AgentMetricPill label="RECALL" value={null} />
                      <AgentMetricPill label="PREC" value={null} />
                      <AgentMetricPill label="CIT" value={null} />
                    </div>

                    {/* Arrow */}
                    <span style={{ color: "var(--text-muted)", fontSize: 16, lineHeight: 1 }}>
                      ›
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent runs table */}
      <div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "var(--text-muted)",
            marginBottom: 12,
            letterSpacing: "0.06em",
          }}
        >
          RECENT EVAL RUNS — ALL AGENTS
        </div>
        {isLoading ? (
          <div style={{ color: "var(--text-muted)" }}>Loading…</div>
        ) : (
          <RunsTable runs={dashboard?.recent_runs ?? []} showAgentLink />
        )}
      </div>
    </div>
  );
}

function AgentMetricPill({ label, value }: { label: string; value: number | null }) {
  const display = value != null ? `${Math.round(value * 100)}%` : "—";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.05em" }}>
        {label}
      </span>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{display}</span>
    </div>
  );
}

function MetricCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: number;
  delta: number;
}) {
  const pct = Math.round(value * 100);
  const deltaPt = Math.round(delta * 100);
  return (
    <div
      style={{
        padding: "16px 20px",
        border: "1px solid var(--border)",
        borderRadius: 8,
        minWidth: 140,
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
        <span style={{ fontSize: 28, fontWeight: 700 }}>{pct}%</span>
        <span style={{ fontSize: 12, color: deltaPt >= 0 ? "#0a0" : "#e53" }}>
          {deltaPt >= 0 ? "+" : ""}
          {deltaPt}pt
        </span>
      </div>
    </div>
  );
}
