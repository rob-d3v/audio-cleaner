import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import type { PromptTemplate, PromptTemplateKind } from "@/api/types";

export function usePromptTemplates(kind?: PromptTemplateKind) {
  return useQuery({
    queryKey: queryKeys.promptTemplates(kind),
    queryFn: () => api.get<PromptTemplate[]>("/api/prompt-templates", kind ? { kind } : undefined),
  });
}

export function useCreatePromptTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<PromptTemplate, "id" | "builtin">) =>
      api.post<PromptTemplate>("/api/prompt-templates", payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prompt-templates"] }),
  });
}

export function useDeletePromptTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/prompt-templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prompt-templates"] }),
  });
}

export function useRenderPromptTemplate() {
  return useMutation({
    mutationFn: (payload: { template_id: string; variables: Record<string, unknown> }) =>
      api.post<{ text: string }>("/api/prompt-templates/render", payload),
  });
}
