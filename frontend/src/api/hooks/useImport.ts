import { useMutation } from "@tanstack/react-query";

import { api } from "@/api/client";
import type { ImportExecutePayload, ImportScanResult, JobRef } from "@/api/types";

export function useImportScan() {
  return useMutation({
    mutationFn: (payload: { path: string; marker_mapping?: Record<string, string> }) =>
      api.post<ImportScanResult>("/api/import/scan", payload),
  });
}

export function useImportExecute() {
  return useMutation({
    mutationFn: (payload: ImportExecutePayload) =>
      api.post<JobRef>("/api/import/execute", payload),
  });
}
