import { useMutation, useQuery } from "@tanstack/react-query";

import { api, apiRequest, ApiError, assetUrl } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import type { JobRef, TakeStems } from "@/api/types";

/**
 * Analyzes a take and finds its strongest 2-minute window (energy/clarity
 * scored per window). Backend route may not exist yet — callers should
 * catch a 404 ApiError and show a "not available yet" message instead of
 * a generic error toast.
 */
export function useBestTwoMin(takeId: string) {
  return useMutation({
    mutationFn: (variant?: string) =>
      apiRequest<JobRef>(`/api/takes/${takeId}/best-two-min`, {
        method: "POST",
        query: { variant: variant ?? "raw" },
      }),
  });
}

export function useSeparateTake(takeId: string) {
  return useMutation({
    mutationFn: (model?: string) =>
      api.post<JobRef>(`/api/takes/${takeId}/separate`, model ? { model } : {}),
  });
}

/**
 * Fetches previously-computed stems for a take. Treats a 404 as "not
 * separated yet" (returns null) rather than surfacing it as a query error —
 * this also covers the case where the backend route isn't deployed yet.
 */
export function useTakeStems(takeId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.takeStems(takeId ?? ""),
    queryFn: async (): Promise<TakeStems | null> => {
      try {
        return await api.get<TakeStems>(`/api/takes/${takeId}/stems`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    enabled: Boolean(takeId),
    retry: false,
  });
}

export function stemAudioUrl(takeId: string, name: string) {
  return assetUrl(`/api/takes/${takeId}/stem/${name}`);
}
