"use client";

import React from "react";

interface BlastGraphProps {
  impactedEndpoints: string[];
}

export function BlastGraph({ impactedEndpoints }: BlastGraphProps) {
  if (impactedEndpoints.length === 0) {
    return (
      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
        No impacted endpoints detected.
      </p>
    );
  }

  return (
    <div>
      <p
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          margin: "0 0 8px 0",
        }}
      >
        Impacted Endpoints
      </p>
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {impactedEndpoints.map((ep) => (
          <li
            key={ep}
            style={{
              fontSize: 12,
              fontFamily: "var(--font-mono, monospace)",
              color: "var(--text-secondary)",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: "3px 8px",
            }}
          >
            {ep}
          </li>
        ))}
      </ul>
    </div>
  );
}
