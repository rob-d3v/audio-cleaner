import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, assetUrl } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import type { Project, ProjectMode, ProjectStatus } from "@/api/types";

export interface ProjectFilters {
  status?: ProjectStatus | "all";
  album_id?: string;
  q?: string;
}

export function useProjects(filters: ProjectFilters = {}) {
  const query: Record<string, string> = {};
  if (filters.status && filters.status !== "all") query.status = filters.status;
  if (filters.album_id) query.album_id = filters.album_id;
  if (filters.q) query.q = filters.q;

  return useQuery({
    queryKey: queryKeys.projects(filters),
    queryFn: () => api.get<Project[]>("/api/projects", query),
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.project(id ?? ""),
    queryFn: () => api.get<Project>(`/api/projects/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; mode: ProjectMode }) =>
      api.post<Project>("/api/projects", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function usePatchProject(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      payload: Partial<
        Pick<Project, "name" | "status" | "mode" | "album_id" | "track_hint" | "best_take_id" | "links">
      >,
    ) =>
      api.patch<Project>(`/api/projects/${id}`, payload),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.project(id), data);
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/projects/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function projectCoverUrl(id: string, updatedAt?: string) {
  return assetUrl(`/api/projects/${id}/cover`, updatedAt ? { v: updatedAt } : undefined);
}

export function useUploadProjectCover(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return api.upload<void>(`/api/projects/${id}/cover`, formData);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.project(id) });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useDeleteProjectCover(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<void>(`/api/projects/${id}/cover`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.project(id) });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
