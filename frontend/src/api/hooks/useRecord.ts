import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { api, apiRequest } from "@/api/client";
import { getMeterChannel } from "@/api/ws";
import { queryKeys } from "@/api/queryKeys";
import type { WsMeterChannelMessage } from "@/api/types";
import { useMeterStore } from "@/store/meterStore";
import { useRecordStore } from "@/store/recordStore";

export function useStartRecording() {
  return useMutation({
    mutationFn: (payload: { project_id: string; device_id: number; monitor_only?: boolean }) =>
      api.post<void>("/api/record/start", payload),
  });
}

export function useStopRecording() {
  return useMutation({
    mutationFn: () => api.post<{ take_id: string | null }>("/api/record/stop"),
  });
}

export interface UploadTakeResult {
  take_id: string;
  duration_s: number;
}

function extensionForMime(mimeType: string): string {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
}

/**
 * Uploads audio captured in the browser (getUserMedia + MediaRecorder) as a
 * new take. Mirrors the native start/stop recorder but multipart — the
 * backend transcodes webm/opus, mp4/aac, or wav to WAV 48k mono itself.
 */
export function useUploadTake() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      file,
      projectId,
      sessionLabel,
      mimeType,
    }: {
      file: Blob;
      projectId: string;
      sessionLabel?: string;
      mimeType: string;
    }) => {
      const formData = new FormData();
      formData.append("file", file, `take.${extensionForMime(mimeType)}`);
      formData.append("project_id", projectId);
      if (sessionLabel) formData.append("session_label", sessionLabel);
      return apiRequest<UploadTakeResult>("/api/record/upload", { method: "POST", formData });
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.takes(variables.projectId) });
    },
  });
}

/**
 * Opens the shared /ws/meter socket and fans messages out to the meter and
 * record zustand stores. Mount once near the top of the record page; the
 * underlying WsChannel is a singleton so re-mounts are safe.
 */
export function useMeterChannel() {
  const { t } = useTranslation();

  useEffect(() => {
    const channel = getMeterChannel();
    const setSample = useMeterStore.getState().setSample;
    const setRecordState = useRecordStore.getState().setRecordState;
    const setWsConnected = useRecordStore.getState().setWsConnected;

    const unsubscribeStatus = channel.subscribeStatus((status) => {
      setWsConnected(status === "open");
    });

    const unsubscribeMessages = channel.subscribe((msg: WsMeterChannelMessage) => {
      if (msg.type === "meter") {
        setSample({
          t: msg.t,
          rmsDb: msg.rms_db,
          peakDb: msg.peak_db,
          peakHoldDb: msg.peak_hold_db,
          clip: msg.clip,
        });
      } else if (msg.type === "record_state") {
        setRecordState(msg);
      } else if (msg.type === "error") {
        toast.error(t(`errors.${msg.code}`, { defaultValue: t("errors.unknown") }));
      }
    });

    channel.connect();

    return () => {
      unsubscribeMessages();
      unsubscribeStatus();
    };
  }, [t]);
}
