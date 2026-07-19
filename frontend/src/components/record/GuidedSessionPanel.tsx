import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  CheckCircle2,
  Circle,
  Disc,
  PartyPopper,
  Play,
  RotateCcw,
  SkipForward,
  Square,
  Wand2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useScripts, useScript } from "@/api/hooks/useScripts";
import { useStartRecording, useStopRecording } from "@/api/hooks/useRecord";
import { usePatchTake } from "@/api/hooks/useTakes";
import { useRecordStore } from "@/store/recordStore";
import { ApiError } from "@/api/client";
import { tFallback } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { ScriptStep } from "@/api/types";

function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, "0")}`;
}

export function GuidedSessionPanel({
  projectId,
  deviceId,
  canRecord,
  onTakeRecorded,
}: {
  projectId: string | null;
  deviceId: number | null;
  canRecord: boolean;
  onTakeRecorded?: (takeId: string) => void;
}) {
  const { t } = useTranslation();
  const scriptsQuery = useScripts();
  const scripts = scriptsQuery.data ?? [];

  const [scriptId, setScriptId] = useState("suno-voice-full");
  const scriptQuery = useScript(scriptId);
  const script = scriptQuery.data;
  const steps = script?.steps ?? [];

  const [doneStepIds, setDoneStepIds] = useState<Set<string>>(new Set());
  const [stepTakeIds, setStepTakeIds] = useState<Record<string, string>>({});
  const [currentStepId, setCurrentStepId] = useState<string | null>(null);
  const [timerLeft, setTimerLeft] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [recordingStepId, setRecordingStepId] = useState<string | null>(null);

  const phase = useRecordStore((s) => s.phase);
  const startRecording = useStartRecording();
  const stopRecording = useStopRecording();
  const patchTake = usePatchTake(projectId ?? "");

  // Fall back to the first script the server actually offers if the default
  // id isn't present (or once the list loads and the default is wrong).
  useEffect(() => {
    if (!scriptsQuery.data || scriptsQuery.data.length === 0) return;
    if (!scriptsQuery.data.some((s) => s.id === scriptId)) {
      setScriptId(scriptsQuery.data[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptsQuery.data]);

  // Reset the whole session whenever the roteiro changes.
  useEffect(() => {
    setDoneStepIds(new Set());
    setStepTakeIds({});
    setCurrentStepId(null);
    setRecordingStepId(null);
  }, [scriptId]);

  useEffect(() => {
    if (!currentStepId && steps.length > 0) setCurrentStepId(steps[0].id);
  }, [steps, currentStepId]);

  const currentStep = steps.find((s) => s.id === currentStepId) ?? null;

  // Re-arm the pacing timer whenever the highlighted step changes.
  useEffect(() => {
    setTimerRunning(false);
    setTimerLeft(currentStep?.duration_s ?? 0);
  }, [currentStepId, currentStep?.duration_s]);

  useEffect(() => {
    if (!timerRunning) return;
    if (timerLeft <= 0) {
      setTimerRunning(false);
      return;
    }
    const id = setInterval(() => {
      setTimerLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [timerRunning, timerLeft]);

  const handleError = (err: unknown) => {
    const message = err instanceof ApiError ? tFallback(t, err.messageKey) : t("errors.unknown");
    toast.error(message);
  };

  const markStepDone = (stepId: string) => {
    setDoneStepIds((prev) => {
      const next = new Set(prev);
      next.add(stepId);
      return next;
    });
    setCurrentStepId((prevCurrent) => {
      const idx = steps.findIndex((s) => s.id === stepId);
      const upcoming = steps.slice(idx + 1).find((s) => s.id !== stepId && !doneStepIds.has(s.id));
      return upcoming ? upcoming.id : prevCurrent;
    });
  };

  const handleStartTimer = () => {
    setTimerLeft((s) => (s <= 0 ? (currentStep?.duration_s ?? 0) : s));
    setTimerRunning(true);
  };

  const handleSkipTimer = () => {
    setTimerRunning(false);
    setTimerLeft(0);
  };

  const handleRecordStep = (step: ScriptStep) => {
    if (!projectId || deviceId === null) return;
    startRecording.mutate(
      { project_id: projectId, device_id: deviceId },
      { onSuccess: () => setRecordingStepId(step.id), onError: handleError },
    );
  };

  const handleStopStep = (step: ScriptStep) => {
    stopRecording.mutate(undefined, {
      onSuccess: (res) => {
        setRecordingStepId(null);
        const takeId = res.take_id;
        if (!takeId) return;
        patchTake.mutate(
          { id: takeId, session_label: `${scriptId}:${step.id}` },
          {
            onSuccess: () => {
              setStepTakeIds((prev) => ({ ...prev, [step.id]: takeId }));
              onTakeRecorded?.(takeId);
              markStepDone(step.id);
            },
          },
        );
      },
      onError: handleError,
    });
  };

  const handleRestart = () => {
    setDoneStepIds(new Set());
    setStepTakeIds({});
    setCurrentStepId(steps[0]?.id ?? null);
    setRecordingStepId(null);
  };

  const progressPct = steps.length > 0 ? Math.round((doneStepIds.size / steps.length) * 100) : 0;
  const isComplete = steps.length > 0 && doneStepIds.size === steps.length;

  if (scriptsQuery.isLoading) {
    return (
      <div className="space-y-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <p className="font-heading text-sm font-semibold text-foreground">{t("record.guide.title")}</p>
        <p className="text-sm text-muted-foreground">{t("record.guide.loading")}</p>
      </div>
    );
  }

  if (scriptsQuery.isError || scripts.length === 0) {
    return (
      <div className="space-y-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <p className="font-heading text-sm font-semibold text-foreground">{t("record.guide.title")}</p>
        <p className="text-sm text-muted-foreground">{t("record.guide.unavailable")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <Wand2 className="size-4 text-primary" />
          <p className="font-heading text-sm font-semibold text-foreground">{t("record.guide.title")}</p>
        </div>
        <p className="text-xs text-muted-foreground">{t("record.guide.subtitle")}</p>
      </div>

      {scripts.length > 1 && (
        <Select value={scriptId} onValueChange={setScriptId}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {scripts.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {tFallback(t, s.name_key, s.id)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {script?.description_key && (
        <p className="text-xs text-muted-foreground">{tFallback(t, script.description_key, script.id)}</p>
      )}

      {!canRecord && (
        <p className="rounded-md bg-muted/60 px-2.5 py-1.5 text-xs text-muted-foreground">
          {t("record.guide.select_project_device")}
        </p>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-foreground">
            {t("record.guide.progress", { done: doneStepIds.size, total: steps.length })}
          </span>
          <span className="font-numeric text-muted-foreground">{progressPct}%</span>
        </div>
        <Progress value={progressPct} />
      </div>

      {isComplete ? (
        <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/[0.06] p-4 text-center">
          <PartyPopper className="mx-auto size-6 text-primary" />
          <p className="font-heading text-sm font-semibold text-foreground">{t("record.guide.complete_title")}</p>
          <p className="text-xs text-muted-foreground">{t("record.guide.complete_body")}</p>
          <Button type="button" variant="outline" size="sm" onClick={handleRestart} className="gap-1.5">
            <RotateCcw className="size-3.5" /> {t("record.guide.restart")}
          </Button>
        </div>
      ) : (
        <Accordion type="single" value={currentStepId ?? undefined} onValueChange={(v) => v && setCurrentStepId(v)}>
          {steps.map((step, idx) => {
            const isDone = doneStepIds.has(step.id);
            const isCurrent = step.id === currentStepId;
            const isThisStepRecording = phase === "recording" && recordingStepId === step.id;
            const canRecordThisStep = canRecord && (phase === "idle" || isThisStepRecording);

            return (
              <AccordionItem key={step.id} value={step.id}>
                <AccordionTrigger className="gap-2">
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    {isDone ? (
                      <CheckCircle2 className="size-4 shrink-0 text-primary" />
                    ) : (
                      <Circle
                        className={cn(
                          "size-4 shrink-0",
                          isCurrent ? "text-primary" : "text-muted-foreground/40",
                        )}
                      />
                    )}
                    <span className={cn("truncate", isDone && "text-muted-foreground line-through")}>
                      {idx + 1}. {tFallback(t, step.name_key, step.id)}
                    </span>
                  </span>
                  <Badge variant="outline" className="font-numeric shrink-0 text-[10px]">
                    {formatCountdown(step.duration_s)}
                  </Badge>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    <p className="text-sm text-foreground">{tFallback(t, step.instruction_key)}</p>
                    {step.bars && (
                      <p className="text-xs text-muted-foreground">{t("record.guide.bars_hint", { bars: step.bars })}</p>
                    )}

                    <div className="flex items-center gap-3">
                      <span className="font-numeric w-10 text-sm text-foreground">{formatCountdown(timerLeft)}</span>
                      <Progress
                        value={step.duration_s > 0 ? ((step.duration_s - timerLeft) / step.duration_s) * 100 : 0}
                        className="h-1.5 flex-1"
                      />
                      <div className="flex shrink-0 gap-1.5">
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="outline"
                          onClick={handleStartTimer}
                          disabled={timerRunning}
                          title={t("record.guide.start_timer")}
                        >
                          <Play />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="outline"
                          onClick={handleSkipTimer}
                          disabled={!timerRunning && timerLeft === 0}
                          title={t("record.guide.skip_timer")}
                        >
                          <SkipForward />
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {step.record ? (
                        isThisStepRecording ? (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleStopStep(step)}
                            disabled={stopRecording.isPending}
                            className="gap-1.5 bg-alert text-alert-foreground hover:bg-alert/90"
                          >
                            <Square className="size-3 fill-current" /> {t("record.guide.stop_step")}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleRecordStep(step)}
                            disabled={!canRecordThisStep || startRecording.isPending}
                            className="gap-1.5 bg-alert text-alert-foreground hover:bg-alert/90"
                          >
                            <Disc className="size-3" /> {t("record.guide.record_step")}
                          </Button>
                        )
                      ) : (
                        !isDone && (
                          <Button type="button" size="sm" variant="outline" onClick={() => markStepDone(step.id)} className="gap-1.5">
                            <CheckCircle2 className="size-3.5" /> {t("record.guide.mark_done")}
                          </Button>
                        )
                      )}
                      {stepTakeIds[step.id] && (
                        <Badge variant="outline" className="border-primary/30 text-primary">
                          {t("record.guide.step_recorded")}
                        </Badge>
                      )}
                      {!step.record && (
                        <span className="text-[11px] text-muted-foreground">{t("record.guide.no_record_step")}</span>
                      )}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}
