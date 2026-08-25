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
  const [view, setView] = useState<"tree" | "graph">("tree");

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

  const toggle = (
    <div style={{ display: "flex", gap: 2, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 6, padding: 2 }}>
      {(["tree", "graph"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => {
            if (v === "graph") setGraphOpen(true);
            setView(v);
          }}
          style={{
            background: view === v ? "var(--bg-surface, #fff)" : "none",
            border: view === v ? "1px solid var(--border)" : "1px solid transparent",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 11,
            fontWeight: 600,
            color: view === v ? "var(--text-primary, inherit)" : "var(--text-muted)",
            padding: "2px 10px",
            textTransform: "capitalize",
          }}
        >
          {v.charAt(0).toUpperCase() + v.slice(1)}
        </button>
      ))}
    </div>
  );

  return (
    <Card pad style={{ marginBottom: 0 }}>
      <SectionLabel icon="Zap" right={toggle}>
        {t("blastRadius.title")}
      </SectionLabel>

      {blastRadius.degraded && (
        <div style={{
          fontSize: 12,
          color: "var(--warning, #b45309)",
          background: "var(--warning-bg, #fef3c7)",
          border: "1px solid var(--warning-border, #fde68a)",
          borderRadius: 6,
          padding: "6px 12px",
          marginBottom: 12,
        }}>
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

      <SymbolList
        rows={symbolRows}
        repoFullName={repoFullName ?? null}
        headSha={headSha ?? null}
        impactedEndpoints={blastRadius.impactedEndpoints}
        factsByFile={blastRadius.factsByFile}
      />

      <PriorPrsAccordion priorPrs={blastRadius.priorPrs} />

      <BlastGraphLightbox
        impactedEndpoints={blastRadius.impactedEndpoints}
        open={graphOpen}
        onClose={() => { setGraphOpen(false); setView("tree"); }}
      />
    </Card>
  );
}
