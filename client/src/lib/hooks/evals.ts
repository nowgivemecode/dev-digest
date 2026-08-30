/* hooks/evals.ts — React Query hooks for Eval Cases, Eval Runs, and the Eval Dashboard. */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type {
  EvalCase,
  EvalCaseInput,
  EvalRunRecord,
  EvalRunResult,
  EvalDashboard,
} from "@devdigest/shared";

export function useEvalCases(agentId: string | null | undefined) {
  return useQuery({
    queryKey: ["eval-cases", agentId],
    queryFn: () => api.get<EvalCase[]>(`/agents/${agentId}/eval-cases`),
    enabled: !!agentId,
  });
}

export function useEvalRuns(agentId: string | null | undefined) {
  return useQuery({
    queryKey: ["eval-runs", agentId],
    queryFn: () => api.get<EvalRunRecord[]>(`/agents/${agentId}/eval-runs`),
    enabled: !!agentId,
  });
}

export function useCreateEvalCase(agentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EvalCaseInput) =>
      api.post<EvalCase>(`/agents/${agentId}/eval-cases`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["eval-cases", agentId] }),
  });
}

export function useUpdateEvalCase(agentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: EvalCaseInput }) =>
      api.put<EvalCase>(`/agents/${agentId}/eval-cases/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["eval-cases", agentId] }),
  });
}

export function useDeleteEvalCase(agentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (caseId: string) =>
      api.del<void>(`/agents/${agentId}/eval-cases/${caseId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["eval-cases", agentId] }),
  });
}

export function useRunAllEvals(agentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<EvalRunResult[]>(`/agents/${agentId}/eval-runs`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eval-cases", agentId] });
      qc.invalidateQueries({ queryKey: ["eval-runs", agentId] });
    },
  });
}

export function useRunSingleCase(agentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (caseId: string) =>
      api.post<EvalRunResult>(`/agents/${agentId}/eval-cases/${caseId}/runs`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eval-cases", agentId] });
      qc.invalidateQueries({ queryKey: ["eval-runs", agentId] });
    },
  });
}

export function useEvalDashboard() {
  return useQuery({
    queryKey: ["eval-dashboard"],
    queryFn: () => api.get<EvalDashboard>("/evals/dashboard"),
  });
}
