import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import type { PipelineStage } from "@/api/types";

export function usePipelineStages() {
  return useQuery({
    queryKey: queryKeys.pipelineStages,
    queryFn: () => api.get<PipelineStage[]>("/api/pipeline/stages"),
    staleTime: 5 * 60_000,
  });
}
