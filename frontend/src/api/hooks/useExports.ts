import { useMutation } from "@tanstack/react-query";

import { api, assetUrl } from "@/api/client";
import type { ExportRequest, JobRef } from "@/api/types";

export function useExportTake(takeId: string) {
  return useMutation({
    mutationFn: (payload: ExportRequest) =>
      api.post<JobRef>(`/api/takes/${takeId}/export`, payload),
  });
}

export function exportDownloadUrl(filename: string) {
  return assetUrl(`/api/exports/${encodeURIComponent(filename)}/download`);
}
