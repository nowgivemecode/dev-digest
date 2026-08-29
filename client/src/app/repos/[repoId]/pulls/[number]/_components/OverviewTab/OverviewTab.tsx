"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { SectionLabel } from "@devdigest/ui";
import { s } from "./styles";
import { IntentCard } from "./IntentCard";
import { PrBriefCard } from "./PrBriefCard";

interface OverviewTabProps {
  prBody: string | null | undefined;
  prId: string | null;
  headSha?: string | null;
}

export function OverviewTab({ prBody, prId, headSha }: OverviewTabProps) {
  const t = useTranslations("prReview");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {prId && headSha && <PrBriefCard prId={prId} headSha={headSha} />}
      {prId && <IntentCard prId={prId} />}
      {prBody && (
        <section>
          <SectionLabel icon="MessageSquare">{t("overview.descriptionLabel")}</SectionLabel>
          <div style={s.descriptionBox}>{prBody}</div>
        </section>
      )}
    </div>
  );
}
