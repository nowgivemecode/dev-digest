"use client";

import React from "react";

interface SummaryBarProps {
  symbolCount: number;
  callerCount: number;
  endpointCount: number;
  cronCount: number;
  degraded: boolean;
}

export function SummaryBar({
  symbolCount,
  callerCount,
  endpointCount,
  cronCount,
  degraded,
}: SummaryBarProps) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        alignItems: "center",
        padding: "8px 0",
        borderBottom: "1px solid var(--border)",
        marginBottom: 12,
      }}
    >
      <StatPill label="Symbols" count={symbolCount} />
      <StatPill label="Callers" count={callerCount} />
      <StatPill label="Endpoints" count={endpointCount} />
      <StatPill label="Crons" count={cronCount} />
      {degraded && (
        <span
          style={{
            marginLeft: "auto",
            fontSize: 11,
            fontWeight: 600,
            color: "var(--warning, #b45309)",
            background: "var(--warning-bg, #fef3c7)",
            padding: "2px 8px",
            borderRadius: 4,
          }}
        >
          Partial data
        </span>
      )}
    </div>
  );
}

function StatPill({ label, count }: { label: string; count: number }) {
  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        fontSize: 12,
        color: "var(--text-secondary)",
      }}
    >
      <span
        style={{
          fontWeight: 700,
          fontSize: 14,
          color: "var(--text-primary, inherit)",
        }}
      >
        {count}
      </span>
      <span>{label}</span>
    </span>
  );
}
