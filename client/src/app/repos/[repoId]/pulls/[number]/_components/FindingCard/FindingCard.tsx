/* FindingCard — ported from findings.jsx (createElement → TSX).
   Severity icon+label, category, file:line, confidence, markdown rationale +
   suggestion, accept/dismiss actions. Accept/dismiss reflect persisted
   timestamps. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import {
  Icon,
  SeverityBadge,
  CategoryTag,
  MonoLink,
  ConfidenceNum,
  Button,
  Markdown,
  type Severity,
  type Category,
} from "@devdigest/ui";
import type { FindingRecord, FindingActionKind } from "@devdigest/shared";
import { SEV_COLOR, SEV_COLOR_FALLBACK } from "./constants";
import { lineLabel } from "./helpers";
import { githubBlobUrl } from "../../../../../../../lib/utils/githubUrls";
import { notify } from "../../../../../../../lib/contexts/toast";
import { useCreateEvalCase } from "../../../../../../../lib/hooks/evals";
import { s } from "./styles";

/** Isolated sub-component so useCreateEvalCase (and its useQueryClient) is only
    mounted when an agentId is actually provided — avoids "No QueryClient" errors
    in tests/pages that render FindingCard without a QueryClientProvider. */
function EvalCaseButton({
  f,
  agentId,
  prDiff,
  pending,
}: {
  f: FindingRecord;
  agentId: string;
  prDiff?: string;
  pending?: boolean;
}) {
  const accepted = !!f.accepted_at;
  const createEvalCase = useCreateEvalCase(agentId);

  function handleClick() {
    createEvalCase.mutate(
      {
        owner_kind: "agent",
        owner_id: agentId,
        name: f.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 60),
        input_diff: prDiff ?? "",
        expected_output: {
          type: accepted ? "must_find" : "must_not_flag",
          file: f.file,
          start_line: f.start_line ?? 1,
          end_line: f.end_line ?? f.start_line ?? 1,
          ...(accepted ? { severity: f.severity, title: f.title } : {}),
        },
      },
      {
        onSuccess: () => notify.success("Eval case created"),
        onError: (err) =>
          notify.error(err instanceof Error ? err.message : "Failed to create eval case"),
      },
    );
  }

  return (
    <Button
      kind="ghost"
      size="sm"
      icon="FlaskConical"
      disabled={pending || createEvalCase.isPending}
      loading={createEvalCase.isPending}
      onClick={handleClick}
    >
      Turn into eval case
    </Button>
  );
}

export function FindingCard({
  f,
  focused,
  defaultExpanded,
  onAction,
  pending,
  repoFullName,
  headSha,
  agentId,
  prDiff,
}: {
  f: FindingRecord;
  focused?: boolean;
  defaultExpanded?: boolean;
  onAction?: (action: FindingActionKind, reply?: string) => void;
  pending?: boolean;
  repoFullName?: string | null;
  headSha?: string | null;
  agentId?: string;
  prDiff?: string;
}) {
  const t = useTranslations("prReview");
  const [expanded, setExpanded] = React.useState(defaultExpanded ?? false);
  const sevColor = SEV_COLOR[f.severity] ?? SEV_COLOR_FALLBACK;
  const fileHref =
    repoFullName && headSha
      ? githubBlobUrl(repoFullName, headSha, f.file, f.start_line, f.end_line)
      : undefined;
  const accepted = !!f.accepted_at;
  const dismissed = !!f.dismissed_at;
  const muted = accepted || dismissed;
  const showEvalButton = (accepted || dismissed) && !!agentId;

  return (
    <div data-finding-id={f.id} style={s.card(!!focused, sevColor, muted)}>
      <div onClick={() => setExpanded((e) => !e)} style={s.header}>
        <div style={s.badgeWrap}>
          <SeverityBadge severity={f.severity as Severity} compact />
        </div>
        <div style={s.headerMain}>
          <div style={s.titleRow}>
            <span style={s.title(muted, dismissed)}>{f.title}</span>
            <CategoryTag category={f.category as Category} />
            {accepted && <span style={s.acceptedTag}>{t("finding.accepted")}</span>}
            {dismissed && <span style={s.dismissedTag}>{t("finding.dismissed")}</span>}
          </div>
          <div style={s.metaRow}>
            <MonoLink href={fileHref}>
              {f.file}:{lineLabel(f)}
            </MonoLink>
            <ConfidenceNum value={f.confidence} />
          </div>
        </div>
        <Icon.ChevronDown size={16} style={s.chevron(expanded)} />
      </div>

      {expanded && (
        <div style={s.body}>
          <div style={s.prose}>
            <Markdown>{f.rationale}</Markdown>
          </div>
          {f.suggestion && (
            <div style={s.suggestionWrap}>
              <div style={s.suggestionLabel}>{t("finding.suggestedFix")}</div>
              <div style={s.prose}>
                <Markdown>{f.suggestion}</Markdown>
              </div>
            </div>
          )}

          <div style={s.actions}>
            <Button
              kind="secondary"
              size="sm"
              icon="Check"
              disabled={pending}
              active={accepted}
              onClick={() => onAction?.("accept")}
            >
              {t("finding.accept")}
            </Button>
            <Button
              kind="ghost"
              size="sm"
              icon="X"
              disabled={pending}
              active={dismissed}
              onClick={() => onAction?.("dismiss")}
            >
              {t("finding.dismiss")}
            </Button>
            {showEvalButton && (
              <EvalCaseButton f={f} agentId={agentId!} prDiff={prDiff} pending={pending} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
