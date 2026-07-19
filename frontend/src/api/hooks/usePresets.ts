import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import type { Preset } from "@/api/types";

export function usePresets() {
  return useQuery({
    queryKey: queryKeys.presets,
    queryFn: () => api.get<Preset[]>("/api/presets"),
  });
}

export function useCreatePreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (preset: Omit<Preset, "id" | "builtin"> & { id?: string }) =>
      api.post<Preset>("/api/presets", { preset }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.presets }),
  });
}

export function useDeletePreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/presets/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.presets }),
  });
}
