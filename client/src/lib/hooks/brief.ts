/* hooks/brief.ts — React Query hooks for PR brief (smart summary output). */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { PrBriefRecord } from "@devdigest/shared";

/** Fetch the brief for a PR (lazily computed server-side on first access via POST). */
export function useBrief(prId: string, headSha: string) {
  return useQuery({
    queryKey: ["brief", prId, headSha],
    queryFn: () => api.post<PrBriefRecord>(`/pulls/${prId}/brief`),
    enabled: Boolean(prId) && Boolean(headSha),
  });
}

/** Trigger a fresh brief computation for a PR and invalidate the cache on success. */
export function useRecomputeBrief(prId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<PrBriefRecord>(`/pulls/${prId}/brief/recompute`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brief", prId] }),
  });
}
