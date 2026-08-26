"use client";

import React from "react";

interface SummaryBarProps {
  symbolCount: number;
  callerCount: number;
  endpointCount: number;
  cronCount: number;
  degraded: boolean;
}

export function SummaryBar({ symbolCount, callerCount, endpointCount, cronCount, degraded }: SummaryBarProps) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", marginBottom: 12 }}>
      <Stat icon="<>" value={symbolCount} label="symbols" />
      <Stat icon="↳" value={callerCount} label="callers" />
      <Stat icon="🌐" value={endpointCount} label="endpoints" />
      {cronCount > 0 && <Stat icon="⏱" value={cronCount} label="cron" />}
      {degraded && (
        <span style={{
          marginLeft: "auto",
          fontSize: 11,
          fontWeight: 600,
          color: "var(--warning, #b45309)",
          background: "var(--warning-bg, #fef3c7)",
          border: "1px solid var(--warning-border, #fde68a)",
          padding: "2px 8px",
          borderRadius: 4,
        }}>
          Partial data
        </span>
      )}
    </div>
  );
}

function Stat({ icon, value, label }: { icon: string; value: number; label: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)" }}>
      <span style={{ fontSize: 11 }}>{icon}</span>
      <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary, inherit)" }}>{value}</span>
      <span>{label}</span>
    </span>
  );
}
