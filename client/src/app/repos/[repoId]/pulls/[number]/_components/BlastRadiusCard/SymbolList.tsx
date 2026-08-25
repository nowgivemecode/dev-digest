"use client";

import React from "react";
import { githubBlobUrl } from "@/lib/utils/githubUrls";
import type { SymbolRow } from "./helpers";
import type { BlastRadiusResult } from "@devdigest/shared";

interface SymbolListProps {
  rows: SymbolRow[];
  repoFullName: string | null;
  headSha: string | null;
  impactedEndpoints: string[];
  factsByFile?: BlastRadiusResult["factsByFile"];
}

export function SymbolList({ rows, repoFullName, headSha, impactedEndpoints, factsByFile }: SymbolListProps) {
  if (rows.length === 0) {
    return (
      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
        No changed symbols detected.
      </p>
    );
  }

  // Collect crons from factsByFile
  const allCrons: string[] = [];
  if (factsByFile) {
    for (const facts of Object.values(factsByFile)) {
      for (const c of facts.crons) if (!allCrons.includes(c)) allCrons.push(c);
    }
  }

  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 16 }}>
      {rows.map((sym, idx) => (
        <li key={`${sym.file}:${sym.name}`}>
          {/* Symbol header */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <KindBadge kind={sym.kind} />
            <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary, inherit)", fontFamily: "var(--font-mono, monospace)" }}>
              {sym.name}
            </span>
            <span style={{ flex: 1 }} />
            {sym.callers.length > 0 && (
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {sym.callers.length} callers
              </span>
            )}
          </div>

          {/* Callers */}
          {sym.callers.length > 0 && (
            <ul style={{ listStyle: "none", margin: "0 0 6px 8px", padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              {sym.callers.map((c) => {
                const href = repoFullName && headSha
                  ? githubBlobUrl(repoFullName, headSha, c.file, c.line)
                  : null;
                return (
                  <li key={`${c.file}:${c.line}`} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                    <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>↳</span>
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "var(--accent, #2563eb)", textDecoration: "none", fontFamily: "var(--font-mono, monospace)" }}
                      >
                        {c.file}:{c.line}
                      </a>
                    ) : (
                      <span style={{ fontFamily: "var(--font-mono, monospace)", color: "var(--text-secondary)" }}>
                        {c.file}:{c.line}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* Endpoint + cron badges — show under the first symbol */}
          {idx === 0 && (impactedEndpoints.length > 0 || allCrons.length > 0) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6, marginLeft: 8 }}>
              {impactedEndpoints.map((ep) => <EndpointBadge key={ep} endpoint={ep} />)}
              {allCrons.map((c) => <CronBadge key={c} label={c} />)}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function KindBadge({ kind }: { kind: string }) {
  const label = kind === "function" ? "<>" : kind === "class" ? "{ }" : kind.slice(0, 2);
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 700,
      color: "var(--text-muted)",
      background: "var(--bg-elevated)",
      border: "1px solid var(--border)",
      borderRadius: 3,
      padding: "1px 5px",
      fontFamily: "var(--font-mono, monospace)",
      flexShrink: 0,
    }}>
      {label}
    </span>
  );
}

function EndpointBadge({ endpoint }: { endpoint: string }) {
  const [method, ...rest] = endpoint.split(" ");
  const path = rest.join(" ");
  const color = METHOD_COLOR[method?.toUpperCase() ?? ""] ?? { bg: "#6b7280", text: "#fff" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 4, overflow: "hidden", fontSize: 11, fontFamily: "var(--font-mono, monospace)" }}>
      <span style={{ background: color.bg, color: color.text, fontWeight: 700, padding: "2px 6px" }}>
        {method}
      </span>
      <span style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)", padding: "2px 6px", border: "1px solid var(--border)", borderLeft: "none", borderRadius: "0 4px 4px 0" }}>
        {path}
      </span>
    </span>
  );
}

function CronBadge({ label }: { label: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 11, fontFamily: "var(--font-mono, monospace)",
      background: "#fff7ed", color: "#c2410c",
      border: "1px solid #fed7aa", borderRadius: 4, padding: "2px 8px",
    }}>
      <span>⏱</span>
      {label}
    </span>
  );
}

const METHOD_COLOR: Record<string, { bg: string; text: string } | undefined> = {
  GET:    { bg: "#0d9488", text: "#fff" },
  POST:   { bg: "#2563eb", text: "#fff" },
  PUT:    { bg: "#7c3aed", text: "#fff" },
  PATCH:  { bg: "#7c3aed", text: "#fff" },
  DELETE: { bg: "#dc2626", text: "#fff" },
  DEFAULT:{ bg: "#6b7280", text: "#fff" },
};
