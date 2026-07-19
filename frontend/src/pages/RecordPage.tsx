import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Circle, Disc, Headphones, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LevelMeter } from "@/components/record/LevelMeter";
import { DeviceSelector } from "@/components/record/DeviceSelector";
import { ProjectSelector } from "@/components/record/ProjectSelector";
import { GuidedSessionPanel } from "@/components/record/GuidedSessionPanel";
import { TakeMiniList } from "@/components/record/TakeMiniList";
import { useMeterChannel, useStartRecording, useStopRecording } from "@/api/hooks/useRecord";
import { useRecordStore } from "@/store/recordStore";
import { ApiError } from "@/api/client";
import { tFallback } from "@/lib/labels";
import { cn } from "@/lib/utils";

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function RecordPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [projectId, setProjectId] = useState<string | null>(searchParams.get("project"));
  const [deviceId, setDeviceId] = useState<number | null>(null);
  const [sessionTakeIds, setSessionTakeIds] = useState<string[]>([]);

  useMeterChannel();
  const phase = useRecordStore((s) => s.phase);
  const elapsedS = useRecordStore((s) => s.elapsedS);
  const wsConnected = useRecordStore((s) => s.wsConnected);

  const startRecording = useStartRecording();
  const stopRecording = useStopRecording();

  const canStart = Boolean(projectId) && deviceId !== null && wsConnected;
  const isRecording = phase === "recording";
  const isMonitoring = phase === "monitoring";
  const isBusy = startRecording.isPending || stopRecording.isPending;

  const handleError = (err: unknown) => {
    const message = err instanceof ApiError ? tFallback(t, err.messageKey) : t("errors.unknown");
    toast.error(message);
  };

  const handleMonitor = () => {
    if (!projectId || deviceId === null) return;
    startRecording.mutate(
      { project_id: projectId, device_id: deviceId, monitor_only: true },
      { onError: handleError },
    );
  };

  const handleRecord = () => {
    if (!projectId || deviceId === null) return;
    startRecording.mutate({ project_id: projectId, device_id: deviceId }, { onError: handleError });
  };

  const handleStop = () => {
    stopRecording.mutate(undefined, {
      onSuccess: (res) => {
        if (res.take_id) setSessionTakeIds((prev) => [res.take_id as string, ...prev]);
      },
      onError: handleError,
    });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 lg:p-8">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">{t("record.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("record.subtitle")}</p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ProjectSelector value={projectId} onChange={setProjectId} disabled={isRecording || isMonitoring} />
            <DeviceSelector value={deviceId} onChange={setDeviceId} disabled={isRecording || isMonitoring} />
          </div>

          <LevelMeter />

          {!wsConnected && <p className="text-xs text-caution">{t("record.ws_disconnected")}</p>}

          <div className="flex flex-wrap items-center gap-3">
            {isRecording ? (
              <Button
                type="button"
                size="lg"
                onClick={handleStop}
                disabled={isBusy}
                className="gap-2 bg-alert text-alert-foreground hover:bg-alert/90"
              >
                <Square className="fill-current" /> {t("record.stop_button")}
              </Button>
            ) : (
              <Button
                type="button"
                size="lg"
                onClick={handleRecord}
                disabled={!canStart || isBusy}
                className="gap-2 bg-alert text-alert-foreground hover:bg-alert/90"
              >
                <Disc /> {t("record.record_button")}
              </Button>
            )}

            {isMonitoring ? (
              <Button type="button" variant="outline" onClick={handleStop} disabled={isBusy}>
                <Headphones /> {t("record.monitor_stop_button")}
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={handleMonitor} disabled={!canStart || isBusy || isRecording}>
                <Headphones /> {t("record.monitor_button")}
              </Button>
            )}

            {(isRecording || isMonitoring) && (
              <div className="flex items-center gap-2 font-numeric text-sm text-foreground">
                <Circle
                  className={cn("size-2.5 fill-current text-alert", isRecording && "animate-[rec-pulse_1s_ease-in-out_infinite]")}
                />
                {formatElapsed(elapsedS)}
              </div>
            )}
          </div>

          {!projectId && <p className="text-xs text-muted-foreground">{t("record.select_project_first")}</p>}
          {projectId && deviceId === null && (
            <p className="text-xs text-muted-foreground">{t("record.select_device_first")}</p>
          )}

          <div className="space-y-2 pt-2">
            <h2 className="font-heading text-sm font-semibold text-foreground">{t("record.takes_title")}</h2>
            {projectId ? (
              <TakeMiniList projectId={projectId} takeIds={sessionTakeIds} />
            ) : (
              <p className="text-sm text-muted-foreground">{t("record.takes_empty")}</p>
            )}
          </div>
        </div>

        <GuidedSessionPanel
          projectId={projectId}
          deviceId={deviceId}
          canRecord={canStart}
          onTakeRecorded={(takeId) => setSessionTakeIds((prev) => [takeId, ...prev])}
        />
      </div>
    </div>
  );
}
