import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import type { RecordingScript } from "@/api/types";

export function useScripts() {
  return useQuery({
    queryKey: queryKeys.scripts,
    queryFn: () => api.get<RecordingScript[]>("/api/scripts"),
    staleTime: 5 * 60_000,
  });
}

export function useScript(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.script(id ?? ""),
    queryFn: () => api.get<RecordingScript>(`/api/scripts/${id}`),
    enabled: Boolean(id),
    staleTime: 5 * 60_000,
  });
}
