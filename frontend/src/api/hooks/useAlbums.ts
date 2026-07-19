import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import type { Album } from "@/api/types";

export function useAlbums() {
  return useQuery({
    queryKey: queryKeys.albums,
    queryFn: () => api.get<Album[]>("/api/albums"),
  });
}

export function useCreateAlbum() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string }) => api.post<Album>("/api/albums", payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.albums }),
  });
}

export function usePatchAlbum(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name?: string; project_ids?: string[]; cover_project_id?: string | null }) =>
      api.patch<Album>(`/api/albums/${id}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.albums });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useDeleteAlbum() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/albums/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.albums });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
