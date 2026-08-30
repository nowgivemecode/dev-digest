"use client";

import React from "react";
import { useRunSingleCase, useDeleteEvalCase } from "@/lib/hooks/evals";
import type { EvalCase } from "@devdigest/shared";

export function EvalCaseRow({
  evalCase,
  agentId,
  onClick,
}: {
  evalCase: EvalCase;
  agentId: string;
  onClick: () => void;
}) {
  const runSingle = useRunSingleCase(agentId);
  const deleteCase = useDeleteEvalCase(agentId);

  // Determine status from evalCase — we don't have per-case run status here.
  // Use a grey circle as default (never run). The parent could pass lastPass prop.
  // For now, use grey circle always (will be improved when runs are joined).
  const statusColor = "var(--text-muted)";
  const statusSymbol = "○";

  // Extract severity from expected_output if present
  const expected = evalCase.expected_output as any;
  const severity = expected?.severity as string | undefined;
  const expType = expected?.type as string | undefined;

  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 12px",
        borderRadius: 6,
        cursor: "pointer",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
      }}
    >
      <span style={{ color: statusColor, fontSize: 16 }}>{statusSymbol}</span>
      <span style={{ flex: 1, fontWeight: 500, fontSize: 14 }}>
        {evalCase.name}
      </span>
      {severity && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "2px 6px",
            borderRadius: 3,
            background:
              severity === "CRITICAL"
                ? "rgba(229,51,51,0.15)"
                : "rgba(255,165,0,0.15)",
            color: severity === "CRITICAL" ? "#e53" : "orange",
          }}
        >
          {severity}
        </span>
      )}
      {expType && (
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {expType === "must_find" ? "must find" : "must not flag"}
        </span>
      )}
      {/* Action icons */}
      <span
        onClick={(e) => {
          e.stopPropagation();
          runSingle.mutate(evalCase.id);
        }}
        style={{ cursor: "pointer", opacity: 0.6, fontSize: 14 }}
        title="Run"
      >
        ▶
      </span>
      <span
        onClick={(e) => {
          e.stopPropagation();
          if (confirm("Delete this eval case?")) deleteCase.mutate(evalCase.id);
        }}
        style={{ cursor: "pointer", opacity: 0.6, fontSize: 14 }}
        title="Delete"
      >
        🗑
      </span>
    </div>
  );
}
