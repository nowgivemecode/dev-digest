"use client";

import React, { useState } from "react";
import {
  useCreateEvalCase,
  useUpdateEvalCase,
  useRunSingleCase,
} from "@/lib/hooks/evals";
import type { EvalCase } from "@devdigest/shared";

export function EvalCaseModal({
  evalCase,
  agentId,
  onClose,
}: {
  evalCase?: EvalCase;
  agentId: string;
  onClose: () => void;
}) {
  const isEdit = !!evalCase;
  const [name, setName] = useState(evalCase?.name ?? "");
  const [inputDiff, setInputDiff] = useState(evalCase?.input_diff ?? "");
  const [expectedJson, setExpectedJson] = useState(
    evalCase?.expected_output
      ? JSON.stringify(evalCase.expected_output, null, 2)
      : "",
  );
  const [jsonValid, setJsonValid] = useState(true);
  const [activeInputTab, setActiveInputTab] = useState<
    "diff" | "files" | "meta"
  >("diff");

  const createCase = useCreateEvalCase(agentId);
  const updateCase = useUpdateEvalCase(agentId);
  const runSingle = useRunSingleCase(agentId);

  function handleJsonChange(val: string) {
    setExpectedJson(val);
    try {
      JSON.parse(val);
      setJsonValid(true);
    } catch {
      setJsonValid(false);
    }
  }

  function injectSkeleton() {
    setExpectedJson(
      JSON.stringify(
        {
          type: "must_find",
          file: "",
          start_line: 0,
          severity: "CRITICAL",
          title: "",
        },
        null,
        2,
      ),
    );
    setJsonValid(true);
  }

  async function handleSave() {
    if (!jsonValid || !name.trim()) return;
    const input = {
      owner_kind: "agent" as const,
      owner_id: agentId,
      name: name.trim(),
      input_diff: inputDiff,
      expected_output: JSON.parse(expectedJson),
    };
    if (isEdit) {
      await updateCase.mutateAsync({ id: evalCase!.id, input });
    } else {
      await createCase.mutateAsync(input);
    }
    onClose();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "var(--bg-primary)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          width: "min(900px, 95vw)",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              {isEdit ? `Eval case · ${evalCase!.name}` : "New eval case"}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Simulate a PR and assert the expected output
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 20,
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Left: Input */}
          <div
            style={{
              flex: 1,
              borderRight: "1px solid var(--border)",
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 16,
              overflow: "auto",
            }}
          >
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Name *
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="stripe-key-leak"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "var(--bg-surface)",
                  fontSize: 14,
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Input
              </label>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                {(["diff", "files", "meta"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setActiveInputTab(t)}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 4,
                      border: "1px solid var(--border)",
                      background:
                        activeInputTab === t
                          ? "var(--accent)"
                          : "var(--bg-surface)",
                      color:
                        activeInputTab === t ? "#fff" : "var(--text-primary)",
                      cursor: "pointer",
                      fontSize: 13,
                    }}
                  >
                    {t === "diff" ? "Diff" : t === "files" ? "Files" : "PR meta"}
                  </button>
                ))}
              </div>
              {activeInputTab === "diff" && (
                <textarea
                  value={inputDiff}
                  onChange={(e) => setInputDiff(e.target.value)}
                  placeholder="Paste unified diff here…"
                  style={{
                    width: "100%",
                    minHeight: 200,
                    fontFamily: "monospace",
                    fontSize: 12,
                    padding: 12,
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    background: "var(--bg-surface)",
                    resize: "vertical",
                    boxSizing: "border-box",
                  }}
                />
              )}
              {activeInputTab !== "diff" && (
                <div
                  style={{ color: "var(--text-muted)", fontSize: 13, padding: 12 }}
                >
                  {activeInputTab === "files"
                    ? "File contents (optional)"
                    : "PR metadata (optional)"}
                </div>
              )}
            </div>
          </div>

          {/* Right: Expected output */}
          <div
            style={{
              flex: 1,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              overflow: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <label style={{ fontSize: 12, fontWeight: 600 }}>
                Expected output
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <span
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: 4,
                    background: jsonValid
                      ? "rgba(0,200,0,0.15)"
                      : "rgba(229,51,51,0.15)",
                    color: jsonValid ? "#0a0" : "#e53",
                    fontWeight: 600,
                  }}
                >
                  {jsonValid ? "valid JSON" : "invalid JSON"}
                </span>
                <button
                  onClick={injectSkeleton}
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: 4,
                    border: "1px solid var(--border)",
                    cursor: "pointer",
                    background: "var(--bg-surface)",
                  }}
                >
                  Finding skeleton
                </button>
              </div>
            </div>
            <textarea
              value={expectedJson}
              onChange={(e) => handleJsonChange(e.target.value)}
              placeholder='{ "type": "must_find", "file": "src/config.ts", "start_line": 12 }'
              style={{
                flex: 1,
                minHeight: 200,
                fontFamily: "monospace",
                fontSize: 12,
                padding: 12,
                borderRadius: 6,
                border: `1px solid ${jsonValid ? "var(--border)" : "#e53"}`,
                background: "var(--bg-surface)",
                resize: "none",
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 24px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              cursor: "pointer",
              background: "var(--bg-surface)",
            }}
          >
            Cancel
          </button>
          {isEdit && (
            <button
              onClick={() => runSingle.mutate(evalCase!.id)}
              disabled={runSingle.isPending}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                cursor: "pointer",
                background: "var(--bg-surface)",
              }}
            >
              {runSingle.isPending ? "Running…" : "Run case"}
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={
              !jsonValid ||
              !name.trim() ||
              createCase.isPending ||
              updateCase.isPending
            }
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              background: "var(--accent, #4f6ef7)",
              color: "#fff",
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
