"use client";

import React, { useState } from "react";
import type { BlastRadiusResult } from "@devdigest/shared";

interface PriorPrsAccordionProps {
  priorPrs: BlastRadiusResult["priorPrs"];
}

export function PriorPrsAccordion({ priorPrs }: PriorPrsAccordionProps) {
  const [open, setOpen] = useState(false);

  if (!priorPrs || priorPrs.length === 0) return null;

  return (
    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 12 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text-secondary)",
          padding: 0,
        }}
      >
        <span style={{ fontSize: 10, transform: open ? "rotate(90deg)" : "none", display: "inline-block", transition: "transform 0.15s" }}>
          ▶
        </span>
        Prior PRs touching the same symbols ({priorPrs.length})
      </button>
      {open && (
        <ul style={{ listStyle: "none", margin: "8px 0 0 16px", padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          {priorPrs.map((pr) => (
            <li key={pr.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <StatusBadge status={pr.status} />
              <span style={{ color: "var(--text-secondary)" }}>
                #{pr.number} — {pr.title}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "merged"
      ? "var(--ok, #16a34a)"
      : status === "open"
        ? "var(--accent, #2563eb)"
        : "var(--text-muted)";

  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        color,
        letterSpacing: "0.04em",
        flexShrink: 0,
      }}
    >
      {status}
    </span>
  );
}
