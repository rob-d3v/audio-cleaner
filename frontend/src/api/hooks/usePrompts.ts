import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import type { ProjectPrompts, PromptHistoryEntry, PromptKind } from "@/api/types";

export function useProjectPrompts(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.prompts(projectId ?? ""),
    queryFn: () => api.get<ProjectPrompts>(`/api/projects/${projectId}/prompts`),
    enabled: Boolean(projectId),
  });
}

export function usePutProjectPrompt(projectId: string, kind: PromptKind) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { text: string; template_id?: string; variables?: Record<string, unknown> }) =>
      api.put<void>(`/api/projects/${projectId}/prompts/${kind}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.prompts(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.promptHistory(projectId, kind) });
    },
  });
}

export function useProjectPromptHistory(projectId: string | undefined, kind: PromptKind) {
  return useQuery({
    queryKey: queryKeys.promptHistory(projectId ?? "", kind),
    queryFn: () =>
      api.get<PromptHistoryEntry[]>(`/api/projects/${projectId}/prompts/${kind}/history`),
    enabled: Boolean(projectId),
  });
}
