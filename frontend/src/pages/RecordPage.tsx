import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Circle, Disc, Headphones, Server, Smartphone, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LevelMeter } from "@/components/record/LevelMeter";
import { DeviceSelector } from "@/components/record/DeviceSelector";
import { ProjectSelector } from "@/components/record/ProjectSelector";
import { BrowserRecorder } from "@/components/record/BrowserRecorder";
import { GuidedSessionPanel } from "@/components/record/GuidedSessionPanel";
import { TakeMiniList } from "@/components/record/TakeMiniList";
import { useMeterChannel, useStartRecording, useStopRecording } from "@/api/hooks/useRecord";
import { useDevices } from "@/api/hooks/useDevices";
import { useRecordStore } from "@/store/recordStore";
import { useBrowserRecorder } from "@/hooks/useBrowserRecorder";
import { ApiError } from "@/api/client";
import { tFallback, formatDuration } from "@/lib/labels";
import { cn } from "@/lib/utils";

type RecorderMode = "native" | "browser";

// Native (server-mic) recording only makes sense when the browser tab and
// the FastAPI server are the same machine — otherwise "record" would arm a
// microphone the person in front of the screen isn't next to.
const IS_LOCALHOST =
  typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);

export default function RecordPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [projectId, setProjectId] = useState<string | null>(searchParams.get("project"));
  const [deviceId, setDeviceId] = useState<number | null>(null);
  const [sessionTakeIds, setSessionTakeIds] = useState<string[]>([]);
  const [modeOverride, setModeOverride] = useState<RecorderMode | null>(null);

  useMeterChannel();
  const phase = useRecordStore((s) => s.phase);
  const elapsedS = useRecordStore((s) => s.elapsedS);
  const wsConnected = useRecordStore((s) => s.wsConnected);

  const devicesQuery = useDevices();
  const browserRecorder = useBrowserRecorder();

  const startRecording = useStartRecording();
  const stopRecording = useStopRecording();

  // Default to native only on localhost with a server mic available (or
  // still loading — optimistic default, corrected once the query settles);
  // everywhere else (phone, remote machine) the browser recorder is primary.
  const nativeDefaultOk = IS_LOCALHOST && (devicesQuery.isLoading || (devicesQuery.data?.length ?? 0) > 0);
  const mode: RecorderMode = modeOverride ?? (nativeDefaultOk ? "native" : "browser");

  const isRecording = mode === "browser" ? browserRecorder.state === "recording" : phase === "recording";
  const isMonitoring = mode === "native" && phase === "monitoring";
  const canStart =
    mode === "browser"
      ? Boolean(projectId) && browserRecorder.supported
      : Boolean(projectId) && deviceId !== null && wsConnected;
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
    <div className="mx-auto max-w-6xl space-y-6 p-4 pb-24 sm:p-6 md:pb-6 lg:p-8">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">{t("record.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("record.subtitle")}</p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <ProjectSelector value={projectId} onChange={setProjectId} disabled={isRecording || isMonitoring} />

          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-muted-foreground">{t("record.mode.label")}</span>
            <ToggleGroup
              type="single"
              value={mode}
              onValueChange={(v) => v && setModeOverride(v as RecorderMode)}
              variant="outline"
              className="flex-wrap"
            >
              <ToggleGroupItem
                value="browser"
                disabled={isRecording || isMonitoring}
                className="h-10 gap-1.5 md:h-7"
              >
                <Smartphone className="size-3.5" /> {t("record.mode.browser")}
              </ToggleGroupItem>
              <ToggleGroupItem
                value="native"
                disabled={!IS_LOCALHOST || isRecording || isMonitoring}
                title={!IS_LOCALHOST ? t("record.mode.native_unavailable_hint") : undefined}
                className="h-10 gap-1.5 md:h-7"
              >
                <Server className="size-3.5" /> {t("record.mode.native")}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {mode === "native" ? (
            <div className="space-y-5">
              <DeviceSelector value={deviceId} onChange={setDeviceId} disabled={isRecording || isMonitoring} />

              <LevelMeter />

              {!wsConnected && <p className="text-xs text-caution">{t("record.ws_disconnected")}</p>}

              <div className="flex flex-wrap items-center gap-3">
                {isRecording ? (
                  <Button
                    type="button"
                    size="lg"
                    onClick={handleStop}
                    disabled={isBusy}
                    className="h-12 min-w-32 gap-2 bg-alert text-alert-foreground hover:bg-alert/90 md:h-9 md:min-w-0"
                  >
                    <Square className="fill-current" /> {t("record.stop_button")}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="lg"
                    onClick={handleRecord}
                    disabled={!canStart || isBusy}
                    className="h-12 min-w-32 gap-2 bg-alert text-alert-foreground hover:bg-alert/90 md:h-9 md:min-w-0"
                  >
                    <Disc /> {t("record.record_button")}
                  </Button>
                )}

                {isMonitoring ? (
                  <Button type="button" variant="outline" onClick={handleStop} disabled={isBusy} className="h-11 md:h-8">
                    <Headphones /> {t("record.monitor_stop_button")}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleMonitor}
                    disabled={!canStart || isBusy || isRecording}
                    className="h-11 md:h-8"
                  >
                    <Headphones /> {t("record.monitor_button")}
                  </Button>
                )}

                {(isRecording || isMonitoring) && (
                  <div className="flex items-center gap-2 font-numeric text-sm text-foreground">
                    <Circle
                      className={cn("size-2.5 fill-current text-alert", isRecording && "animate-[rec-pulse_1s_ease-in-out_infinite]")}
                    />
                    {formatDuration(elapsedS)}
                  </div>
                )}
              </div>

              {!projectId && <p className="text-xs text-muted-foreground">{t("record.select_project_first")}</p>}
              {projectId && deviceId === null && (
                <p className="text-xs text-muted-foreground">{t("record.select_device_first")}</p>
              )}
            </div>
          ) : (
            <BrowserRecorder
              api={browserRecorder}
              projectId={projectId}
              onUploaded={(take) => setSessionTakeIds((prev) => [take.take_id, ...prev])}
            />
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
          recorderMode={mode}
          browserRecorder={browserRecorder}
          onTakeRecorded={(takeId) => setSessionTakeIds((prev) => [takeId, ...prev])}
        />
      </div>
    </div>
  );
}
