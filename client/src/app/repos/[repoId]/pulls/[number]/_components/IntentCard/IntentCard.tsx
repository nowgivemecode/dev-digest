"use client";

import React from "react";
import { Skeleton } from "@devdigest/ui";
import { usePrIntent } from "@/lib/hooks/reviews";
import type { PrIntentResult } from "@devdigest/shared";

interface IntentCardProps {
  prId: string;
}

// Cycles through red → amber → muted for risk area dots.
const RISK_DOT_COLORS = [
  { dot: "var(--crit, #ef4444)",    bg: "rgba(239,68,68,.08)",  border: "rgba(239,68,68,.18)"  },
  { dot: "var(--amber, #f59e0b)",   bg: "rgba(245,158,11,.08)", border: "rgba(245,158,11,.18)" },
  { dot: "var(--text-muted, #6b7280)", bg: "rgba(107,114,128,.08)", border: "rgba(107,114,128,.18)" },
];

function RiskTag({ text, index }: { text: string; index: number }) {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const { dot, bg, border } = RISK_DOT_COLORS[index % RISK_DOT_COLORS.length]!;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px 3px 8px",
        borderRadius: 20,
        background: bg,
        border: `1px solid ${border}`,
        fontSize: 12,
        color: "var(--text-secondary)",
        lineHeight: 1.4,
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: dot,
          flexShrink: 0,
        }}
      />
      {text}
    </span>
  );
}

function IntentCardContent({ data }: { data: PrIntentResult }) {
  const hasCols = data.in_scope.length > 0 || data.out_of_scope.length > 0;

  return (
    <div
      style={{
        background: "var(--bg-elevated, var(--bg-surface))",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
        </svg>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--text-muted)",
          }}
        >
          Intent
        </span>
      </div>

      {/* ── Summary ── */}
      {data.summary && (
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontStyle: "italic",
            color: "var(--text-primary)",
            lineHeight: 1.6,
          }}
        >
          &ldquo;{data.summary}&rdquo;
        </p>
      )}

      {/* ── IN SCOPE + OUT OF SCOPE — 2 columns ── */}
      {hasCols && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
          {/* IN SCOPE */}
          <div
            style={{
              paddingRight: 20,
              borderRight: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                marginBottom: 8,
              }}
            >
              <span style={{ color: "var(--green, #22c55e)", fontSize: 12, fontWeight: 700 }}>✓</span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--green, #22c55e)",
                }}
              >
                In Scope
              </span>
            </div>
            {data.in_scope.length > 0 ? (
              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: 5,
                }}
              >
                {data.in_scope.map((item, i) => (
                  <li
                    key={i}
                    style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.4 }}
                  >
                    · {item}
                  </li>
                ))}
              </ul>
            ) : (
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>—</span>
            )}
          </div>

          {/* OUT OF SCOPE */}
          <div style={{ paddingLeft: 20 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                marginBottom: 8,
              }}
            >
              <span style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 700 }}>✗</span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--text-muted)",
                }}
              >
                Out of Scope
              </span>
            </div>
            {data.out_of_scope.length > 0 ? (
              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: 5,
                }}
              >
                {data.out_of_scope.map((item, i) => (
                  <li
                    key={i}
                    style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}
                  >
                    · {item}
                  </li>
                ))}
              </ul>
            ) : (
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>—</span>
            )}
          </div>
        </div>
      )}

      {/* ── RISK AREAS ── */}
      {data.risk_areas.length > 0 && (
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              marginBottom: 8,
            }}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--text-muted)",
              }}
            >
              Risk Areas
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {data.risk_areas.map((item, i) => (
              <RiskTag key={i} text={item} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * IntentCard — PR intent classifier result, styled after the PR Brief mockup.
 * Returns null when no intent has been classified yet (data === null).
 */
export function IntentCard({ prId }: IntentCardProps) {
  const { data, isLoading } = usePrIntent(prId);

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Skeleton height={16} width={80} />
        <Skeleton height={100} />
      </div>
    );
  }

  if (!data) return null;

  return <IntentCardContent data={data} />;
}
