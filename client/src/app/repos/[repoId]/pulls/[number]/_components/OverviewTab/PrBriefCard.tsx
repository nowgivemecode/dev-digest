"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, SectionLabel, Button, Skeleton } from "@devdigest/ui";
import { useBrief, useRecomputeBrief } from "@/lib/hooks/brief";
import type { PrBriefSeverity } from "@devdigest/shared";

interface PrBriefCardProps {
  prId: string;
  headSha: string;
}

const RISK_COLOUR: Record<PrBriefSeverity, string> = {
  low: "#2e7d32",
  medium: "#78350f",
  high: "#e65100",
  critical: "#d32f2f",
};

const RISK_BG: Record<PrBriefSeverity, string> = {
  low: "#e8f5e9",
  medium: "#fef08a",
  high: "#fbe9e7",
  critical: "#ffebee",
};

function SeverityBadge({ severity }: { severity: PrBriefSeverity }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 7px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        color: RISK_COLOUR[severity],
        backgroundColor: RISK_BG[severity],
      }}
    >
      {severity}
    </span>
  );
}

export function PrBriefCard({ prId, headSha }: PrBriefCardProps) {
  const t = useTranslations("prReview");
  const brief = useBrief(prId, headSha);
  const recompute = useRecomputeBrief(prId);
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleFocusClick() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "diff");
    router.push(`?${params.toString()}`);
  }

  const recomputeButton = (
    <Button
      kind="ghost"
      size="sm"
      icon="RefreshCw"
      loading={recompute.isPending}
      aria-label={t("brief.recomputeAriaLabel")}
      onClick={() => recompute.mutate()}
    >
      {t("brief.recompute")}
    </Button>
  );

  return (
    <Card pad style={{ marginBottom: 0 }}>
      <SectionLabel icon="FileText" right={recomputeButton}>
        {t("brief.sectionLabel")}
      </SectionLabel>

      {brief.isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Skeleton height={16} width="80%" />
          <Skeleton height={14} width="60%" />
          <Skeleton height={14} width="70%" />
        </div>
      )}

      {brief.isError && !brief.isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
            {t("brief.error")}
          </p>
          <Button kind="ghost" size="sm" onClick={() => brief.refetch()}>
            {t("brief.tryAgain")}
          </Button>
        </div>
      )}

      {!brief.isLoading && !brief.isError && brief.data && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Risk level badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
              }}
            >
              {t("brief.riskLevelLabel")}
            </span>
            <SeverityBadge severity={brief.data.risk_level} />
          </div>

          {/* What */}
          <div>
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                margin: "0 0 4px 0",
              }}
            >
              {t("brief.whatLabel")}
            </p>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>
              {brief.data.what}
            </p>
          </div>

          {/* Why */}
          <div>
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                margin: "0 0 4px 0",
              }}
            >
              {t("brief.whyLabel")}
            </p>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>
              {brief.data.why}
            </p>
          </div>

          {/* Risks */}
          {brief.data.risks.length > 0 && (
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
                {t("brief.risksLabel")}
              </p>
              <ol style={{ margin: 0, padding: "0 0 0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                {brief.data.risks.map((risk, i) => (
                  <li key={i} style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{risk.title}</span>
                      <SeverityBadge severity={risk.severity} />
                    </div>
                    <p style={{ margin: "0 0 4px 0" }}>{risk.explanation}</p>
                    {risk.file_refs.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {risk.file_refs.map((ref, j) => (
                          <span
                            key={j}
                            style={{
                              display: "inline-block",
                              padding: "1px 6px",
                              borderRadius: 3,
                              fontSize: 11,
                              fontFamily: "monospace",
                              backgroundColor: "var(--surface-2, #f0f0f0)",
                              color: "var(--text-muted)",
                            }}
                          >
                            {ref}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Review focus */}
          {brief.data.review_focus.length > 0 && (
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
                {t("brief.reviewFocusLabel")}
              </p>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                {brief.data.review_focus.map((item, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={handleFocusClick}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "3px 0",
                        fontSize: 13,
                        color: "var(--link, #1a73e8)",
                        textAlign: "left",
                        width: "100%",
                        fontFamily: "monospace",
                        textDecoration: "underline",
                        textUnderlineOffset: 2,
                      }}
                      title={t("brief.goToFilesTitle")}
                    >
                      {item}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
