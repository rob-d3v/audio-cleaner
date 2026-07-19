import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import type { SystemCapabilities, SystemInfo } from "@/api/types";

export function useSystemInfo() {
  return useQuery({
    queryKey: queryKeys.systemInfo,
    queryFn: () => api.get<SystemInfo>("/api/system/info"),
    staleTime: 5 * 60_000,
  });
}

export function useSystemCapabilities() {
  return useQuery({
    queryKey: queryKeys.systemCapabilities,
    queryFn: () => api.get<SystemCapabilities>("/api/system/capabilities"),
    staleTime: 5 * 60_000,
  });
}
