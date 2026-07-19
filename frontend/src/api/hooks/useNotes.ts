import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import type { NotesState } from "@/api/types";

export function useNotes(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.notes(projectId ?? ""),
    queryFn: () => api.get<NotesState>(`/api/projects/${projectId}/notes`),
    enabled: Boolean(projectId),
  });
}

export function usePutNotes(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => api.put<NotesState>(`/api/projects/${projectId}/notes`, { text }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notes(projectId) });
    },
  });
}
