import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, assetUrl } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import type { JobRef, PipelineChain, Take } from "@/api/types";

export function useTakes(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.takes(projectId ?? ""),
    queryFn: () => api.get<Take[]>(`/api/projects/${projectId}/takes`),
    enabled: Boolean(projectId),
  });
}

export function usePatchTake(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string; rating?: number; notes?: string; session_label?: string }) =>
      api.patch<Take>(`/api/takes/${id}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.takes(projectId) });
    },
  });
}

export function useDeleteTake(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/takes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.takes(projectId) });
    },
  });
}

export function takeAudioUrl(takeId: string, variant: string = "raw") {
  return assetUrl(`/api/takes/${takeId}/audio`, { variant });
}

export function useProcessTake() {
  return useMutation({
    mutationFn: ({
      takeId,
      chain,
      source,
    }: {
      takeId: string;
      chain: PipelineChain;
      source?: string;
    }) => api.post<JobRef>(`/api/takes/${takeId}/process`, { chain, source }),
  });
}
