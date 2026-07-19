import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import type { AudioDevice } from "@/api/types";

export function useDevices() {
  return useQuery({
    queryKey: queryKeys.devices,
    queryFn: () => api.get<AudioDevice[]>("/api/devices"),
    staleTime: 30_000,
  });
}
