"use client";

import React, { Component } from "react";
import { useTranslations } from "next-intl";
import { SectionLabel } from "@devdigest/ui";
import { s } from "./styles";
import { IntentCard } from "./IntentCard";
import { useBlastRadius } from "@/lib/hooks/pulls";
import { BlastRadiusCard } from "../BlastRadiusCard";

interface OverviewTabProps {
  prBody: string | null | undefined;
  prId: string | null;
}

// Simple error boundary so a blast-radius failure doesn't crash the whole tab.
interface EBState { hasError: boolean }
class BlastRadiusErrorBoundary extends Component<{ children: React.ReactNode }, EBState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(): EBState { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
          Failed to load blast radius.
        </p>
      );
    }
    return this.props.children;
  }
}

function BlastRadiusSection({ prId }: { prId: string }) {
  const { data: blastRadius, isLoading: blastLoading } = useBlastRadius(prId);
  return <BlastRadiusCard blastRadius={blastRadius} isLoading={blastLoading} />;
}

export function OverviewTab({ prBody, prId }: OverviewTabProps) {
  const t = useTranslations("prReview");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
        {prId && <IntentCard prId={prId} />}
        {prId && (
          <BlastRadiusErrorBoundary>
            <BlastRadiusSection prId={prId} />
          </BlastRadiusErrorBoundary>
        )}
      </div>
      {prBody && (
        <section>
          <SectionLabel icon="MessageSquare">{t("overview.descriptionLabel")}</SectionLabel>
          <div style={s.descriptionBox}>{prBody}</div>
        </section>
      )}
    </div>
  );
}
