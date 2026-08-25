"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, SectionLabel, Skeleton } from "@devdigest/ui";
import type { BlastRadiusResult } from "@devdigest/shared";
import { buildCronSet, buildSymbolRows } from "./helpers";
import { SummaryBar } from "./SummaryBar";
import { SymbolList } from "./SymbolList";
import { PriorPrsAccordion } from "./PriorPrsAccordion";
import { BlastGraphLightbox } from "./BlastGraphLightbox";

interface BlastRadiusCardProps {
  blastRadius: BlastRadiusResult | undefined;
  isLoading: boolean;
  repoFullName?: string | null;
  headSha?: string | null;
}

export function BlastRadiusCard({ blastRadius, isLoading, repoFullName, headSha }: BlastRadiusCardProps) {
  const t = useTranslations("prReview");
  const [graphOpen, setGraphOpen] = useState(false);

  if (isLoading) {
    return (
      <Card pad style={{ marginBottom: 0 }}>
        <SectionLabel icon="Zap">{t("blastRadius.loadingTitle")}</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Skeleton height={16} width="60%" />
          <Skeleton height={14} width="80%" />
          <Skeleton height={14} width="50%" />
        </div>
      </Card>
    );
  }

  if (!blastRadius) {
    return (
      <Card pad style={{ marginBottom: 0 }}>
        <SectionLabel icon="Zap">{t("blastRadius.emptyTitle")}</SectionLabel>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
          {t("blastRadius.emptyBody")}
        </p>
      </Card>
    );
  }

  const cronSet = buildCronSet(blastRadius.factsByFile);
  const symbolRows = buildSymbolRows(blastRadius);

  return (
    <Card pad style={{ marginBottom: 0 }}>
      <SectionLabel
        icon="Zap"
        right={
          blastRadius.impactedEndpoints.length > 0 ? (
            <button
              type="button"
              onClick={() => setGraphOpen(true)}
              style={{
                background: "none",
                border: "1px solid var(--border)",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                color: "var(--text-secondary)",
                padding: "2px 10px",
              }}
            >
              View graph
            </button>
          ) : undefined
        }
      >
        {t("blastRadius.title")}
      </SectionLabel>

      {blastRadius.degraded && (
        <div
          style={{
            fontSize: 12,
            color: "var(--warning, #b45309)",
            background: "var(--warning-bg, #fef3c7)",
            border: "1px solid var(--warning-border, #fde68a)",
            borderRadius: 6,
            padding: "6px 12px",
            marginBottom: 12,
          }}
        >
          {t("blastRadius.degradedBanner")}
          {blastRadius.reason && (
            <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>
              {blastRadius.reason}
            </span>
          )}
        </div>
      )}

      <SummaryBar
        symbolCount={blastRadius.changedSymbols.length}
        callerCount={blastRadius.callers.length}
        endpointCount={blastRadius.impactedEndpoints.length}
        cronCount={cronSet.size}
        degraded={blastRadius.degraded ?? false}
      />

      <SymbolList rows={symbolRows} repoFullName={repoFullName ?? null} headSha={headSha ?? null} />

      <PriorPrsAccordion priorPrs={blastRadius.priorPrs} />

      <BlastGraphLightbox
        impactedEndpoints={blastRadius.impactedEndpoints}
        open={graphOpen}
        onClose={() => setGraphOpen(false)}
      />
    </Card>
  );
}
