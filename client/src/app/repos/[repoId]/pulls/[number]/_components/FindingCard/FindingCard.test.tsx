import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";
import { FindingCard } from "./FindingCard";

afterEach(cleanup);

// Mock eval hooks so FindingCard renders without a QueryClient / network.
vi.mock("../../../../../../../lib/hooks/evals", () => ({
  useCreateEvalCase: () => ({ mutate: vi.fn(), isPending: false }),
}));

const FINDING: FindingRecord = {
  id: "f1",
  severity: "CRITICAL",
  category: "security",
  title: "Hardcoded Stripe secret key",
  file: "src/config.ts",
  start_line: 11,
  end_line: 11,
  rationale: "A **live** Stripe key is committed in source.",
  suggestion: "Move the key to an environment variable.",
  confidence: 0.95,
  kind: "finding",
  trifecta_components: null,
  evidence: null,
  review_id: "r1",
  accepted_at: null,
  dismissed_at: null,
};

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("FindingCard (smoke, both themes)", () => {
  (["dark", "light"] as const).forEach((theme) => {
    it(`renders severity + file:line + rationale in ${theme}`, () => {
      renderWithIntl(
        <div data-theme={theme}>
          <FindingCard f={FINDING} defaultExpanded onAction={() => {}} />
        </div>,
      );
      expect(screen.getByText("Hardcoded Stripe secret key")).toBeInTheDocument();
      expect(screen.getByText("src/config.ts:11")).toBeInTheDocument();
      // category label is shown alongside the severity badge
      expect(screen.getByText("security")).toBeInTheDocument();
    });
  });

  it("fires accept/dismiss actions", () => {
    const onAction = vi.fn();
    renderWithIntl(<FindingCard f={FINDING} defaultExpanded onAction={onAction} />);
    fireEvent.click(screen.getByText("Accept"));
    expect(onAction).toHaveBeenCalledWith("accept");
    fireEvent.click(screen.getByText("Dismiss"));
    expect(onAction).toHaveBeenCalledWith("dismiss");
  });
});

describe("FindingCard — Turn into eval case button", () => {
  const ACCEPTED_FINDING: FindingRecord = {
    ...FINDING,
    accepted_at: "2026-08-30T10:00:00Z",
    dismissed_at: null,
  };

  const DISMISSED_FINDING: FindingRecord = {
    ...FINDING,
    accepted_at: null,
    dismissed_at: "2026-08-30T10:00:00Z",
  };

  it("shows 'Turn into eval case' button when verdict is accepted and agentId is provided", () => {
    renderWithIntl(
      <FindingCard f={ACCEPTED_FINDING} defaultExpanded agentId="ag1" />,
    );
    expect(screen.getByText("Turn into eval case")).toBeInTheDocument();
  });

  it("shows 'Turn into eval case' button when verdict is dismissed and agentId is provided", () => {
    renderWithIntl(
      <FindingCard f={DISMISSED_FINDING} defaultExpanded agentId="ag1" />,
    );
    expect(screen.getByText("Turn into eval case")).toBeInTheDocument();
  });

  it("does not show 'Turn into eval case' button when verdict is pending (no accepted_at/dismissed_at)", () => {
    renderWithIntl(
      <FindingCard f={FINDING} defaultExpanded agentId="ag1" />,
    );
    expect(screen.queryByText("Turn into eval case")).not.toBeInTheDocument();
  });

  it("does not show 'Turn into eval case' button when agentId is not provided", () => {
    renderWithIntl(
      <FindingCard f={ACCEPTED_FINDING} defaultExpanded />,
    );
    expect(screen.queryByText("Turn into eval case")).not.toBeInTheDocument();
  });
});
