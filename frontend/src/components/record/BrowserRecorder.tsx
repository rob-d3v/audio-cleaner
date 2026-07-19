import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Circle, Disc, MicOff, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LevelMeter } from "@/components/record/LevelMeter";
import { useUploadTake, type UploadTakeResult } from "@/api/hooks/useRecord";
import type { UseBrowserRecorderResult } from "@/hooks/useBrowserRecorder";
import { ApiError } from "@/api/client";
import { tFallback, formatDuration } from "@/lib/labels";
import { cn } from "@/lib/utils";

/**
 * Records raw microphone audio directly in the browser (getUserMedia +
 * MediaRecorder) and uploads it to /api/record/upload. This is the primary
 * recording path when the app is opened from a phone or another machine —
 * there is no server-local mic to talk to in that case.
 */
export function BrowserRecorder({
  api,
  projectId,
  disabled,
  onUploaded,
}: {
  api: UseBrowserRecorderResult;
  projectId: string | null;
  disabled?: boolean;
  onUploaded?: (take: UploadTakeResult) => void;
}) {
  const { t } = useTranslation();
  const uploadTake = useUploadTake();
  const [sessionLabel, setSessionLabel] = useState("");

  const isRecording = api.state === "recording";
  const isBusy = api.state === "requesting" || api.state === "stopping" || uploadTake.isPending;
  const canStart = Boolean(projectId) && !disabled && api.supported && api.state === "idle";

  const handleRecord = async () => {
    try {
      await api.start();
    } catch {
      toast.error(t(api.errorKey ?? "errors.unknown"));
    }
  };

  const handleStop = async () => {
    const result = await api.stop();
    if (!result || !projectId) return;
    uploadTake.mutate(
      { file: result.blob, projectId, sessionLabel: sessionLabel || undefined, mimeType: result.mimeType },
      {
        onSuccess: (take) => {
          toast.success(t("record.browser.upload_success"));
          onUploaded?.(take);
        },
        onError: (err) => {
          const message = err instanceof ApiError ? tFallback(t, err.messageKey) : t("errors.unknown");
          toast.error(message);
        },
      },
    );
  };

  if (!api.supported) {
    return (
      <div className="flex items-start gap-2.5 rounded-xl bg-card p-4 ring-1 ring-alert/30">
        <MicOff className="mt-0.5 size-4 shrink-0 text-alert" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{t("record.browser.unsupported_title")}</p>
          <p className="text-xs text-muted-foreground">
            {typeof window !== "undefined" && !window.isSecureContext
              ? t("errors.insecure_context")
              : t("record.browser.unsupported_body")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {api.devices.length > 0 && (
        <div className="space-y-1.5">
          <Label>{t("record.browser.mic_label")}</Label>
          <Select
            value={api.deviceId ?? "__default__"}
            onValueChange={(v) => api.setDeviceId(v === "__default__" ? null : v)}
            disabled={isRecording || isBusy}
          >
            <SelectTrigger className="h-11 w-full md:h-8">
              <SelectValue placeholder={t("record.browser.mic_placeholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__default__">{t("record.browser.mic_default")}</SelectItem>
              {api.devices.map((device, idx) => (
                <SelectItem key={device.deviceId || idx} value={device.deviceId}>
                  {device.label || t("record.browser.mic_unnamed", { index: idx + 1 })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <LevelMeter getSample={api.getSample} />

      {api.errorKey && <p className="text-xs text-alert">{t(api.errorKey)}</p>}

      <div className="flex flex-wrap items-center gap-3">
        {isRecording ? (
          <Button
            type="button"
            size="lg"
            onClick={handleStop}
            disabled={api.state === "stopping"}
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

        {(isRecording || api.state === "stopping") && (
          <div className="flex items-center gap-2 font-numeric text-sm text-foreground">
            <Circle className={cn("size-2.5 fill-current text-alert", isRecording && "animate-[rec-pulse_1s_ease-in-out_infinite]")} />
            {formatDuration(api.elapsedS)}
          </div>
        )}

        {uploadTake.isPending && (
          <span className="text-xs text-muted-foreground">{t("record.browser.uploading")}</span>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="browser-session-label" className="text-xs text-muted-foreground">
          {t("project.audio.session_label_placeholder")}
        </Label>
        <Input
          id="browser-session-label"
          value={sessionLabel}
          onChange={(e) => setSessionLabel(e.target.value)}
          placeholder={t("project.audio.session_label_placeholder")}
          disabled={isRecording || isBusy}
          className="h-11 max-w-sm md:h-8"
        />
      </div>

      {!projectId && <p className="text-xs text-muted-foreground">{t("record.select_project_first")}</p>}
    </div>
  );
}
