import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { getJobsChannel } from "@/api/ws";
import type { Job, WsJobMessage } from "@/api/types";

/**
 * Tracks a single job's progress. Fetches the current state once via REST,
 * then keeps it live by writing every matching `/ws/jobs` message straight
 * into the query cache — components just `useQuery`-read this hook's
 * result and re-render on each progress tick without polling.
 */
export function useJob(jobId: string | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!jobId) return;
    const channel = getJobsChannel();
    channel.connect();
    return channel.subscribe((msg: WsJobMessage) => {
      if (msg.id !== jobId) return;
      qc.setQueryData(queryKeys.job(jobId), msg as Job);
    });
  }, [jobId, qc]);

  return useQuery({
    queryKey: queryKeys.job(jobId ?? ""),
    queryFn: () => api.get<Job>(`/api/jobs/${jobId}`),
    enabled: Boolean(jobId),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function useCancelJob() {
  return useMutation({
    mutationFn: (jobId: string) => api.post<void>(`/api/jobs/${jobId}/cancel`),
  });
}

/**
 * Fire-and-forget side effect hook: runs `onUpdate` for every WS message
 * matching `jobId`, useful for invalidating unrelated queries (e.g. the
 * takes list) once a job reaches `done` without holding progress state.
 */
export function useJobEffect(jobId: string | undefined, onUpdate: (job: Job) => void) {
  useEffect(() => {
    if (!jobId) return;
    const channel = getJobsChannel();
    channel.connect();
    return channel.subscribe((msg: WsJobMessage) => {
      if (msg.id !== jobId) return;
      onUpdate(msg as Job);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);
}
