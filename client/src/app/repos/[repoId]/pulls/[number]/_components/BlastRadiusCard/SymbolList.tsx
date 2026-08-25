"use client";

import React from "react";
import { githubBlobUrl } from "@/lib/utils/githubUrls";
import type { SymbolRow } from "./helpers";

interface SymbolListProps {
  rows: SymbolRow[];
  repoFullName: string | null;
  headSha: string | null;
}

export function SymbolList({ rows, repoFullName, headSha }: SymbolListProps) {
  if (rows.length === 0) {
    return (
      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
        No changed symbols detected.
      </p>
    );
  }

  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
      {rows.map((sym) => (
        <li key={`${sym.file}:${sym.name}`}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <KindBadge kind={sym.kind} />
            <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary, inherit)" }}>
              {sym.name}
            </span>
            <span
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {sym.file}
            </span>
          </div>
          {sym.callers.length > 0 && (
            <ul style={{ listStyle: "none", margin: "0 0 0 16px", padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              {sym.callers.map((c) => {
                const href =
                  repoFullName && headSha
                    ? githubBlobUrl(repoFullName, headSha, c.file, c.line)
                    : null;
                return (
                  <li key={`${c.file}:${c.line}`} style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: "var(--accent, #2563eb)",
                          textDecoration: "none",
                          fontFamily: "var(--font-mono, monospace)",
                        }}
                      >
                        {c.file}:{c.line}
                      </a>
                    ) : (
                      <span style={{ fontFamily: "var(--font-mono, monospace)" }}>
                        {c.file}:{c.line}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

function KindBadge({ kind }: { kind: string }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        color: "var(--text-muted)",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 3,
        padding: "1px 5px",
        flexShrink: 0,
      }}
    >
      {kind}
    </span>
  );
}
