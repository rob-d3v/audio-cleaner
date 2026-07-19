import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import type { LyricsState, LyricsVersion } from "@/api/types";

export function useLyrics(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.lyrics(projectId ?? ""),
    queryFn: () => api.get<LyricsState>(`/api/projects/${projectId}/lyrics`),
    enabled: Boolean(projectId),
  });
}

export function usePutLyrics(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { text: string; snapshot?: boolean }) =>
      api.put<{ updated_at: string; snapshotted: boolean }>(`/api/projects/${projectId}/lyrics`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.lyrics(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.lyricsVersions(projectId) });
    },
  });
}

export function useLyricsVersions(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.lyricsVersions(projectId ?? ""),
    queryFn: () => api.get<LyricsVersion[]>(`/api/projects/${projectId}/lyrics/versions`),
    enabled: Boolean(projectId),
  });
}

export function useLyricsVersion(projectId: string, ts: number | null) {
  return useQuery({
    queryKey: queryKeys.lyricsVersion(projectId, ts ?? 0),
    queryFn: () => api.get<{ text: string }>(`/api/projects/${projectId}/lyrics/versions/${ts}`),
    enabled: ts !== null,
  });
}

export function useRestoreLyricsVersion(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ts: number) =>
      api.post<void>(`/api/projects/${projectId}/lyrics/versions/${ts}/restore`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.lyrics(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.lyricsVersions(projectId) });
    },
  });
}
