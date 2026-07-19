import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import type { MetaTag } from "@/api/types";

export function useMetaTags() {
  return useQuery({
    queryKey: queryKeys.metaTags,
    queryFn: () => api.get<MetaTag[]>("/api/meta-tags"),
    staleTime: 60_000,
  });
}

export function useCreateMetaTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<MetaTag, "id" | "builtin">) =>
      api.post<MetaTag>("/api/meta-tags", payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.metaTags }),
  });
}

export function useDeleteMetaTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/meta-tags/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.metaTags }),
  });
}
