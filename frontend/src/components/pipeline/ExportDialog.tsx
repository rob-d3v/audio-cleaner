import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { JobProgressBar } from "@/components/shared/JobProgressBar";
import { WaveformPlayer, type WaveformPlayerHandle, type WaveformRegion } from "@/components/player/WaveformPlayer";
import { ScoreSparkline } from "@/components/pipeline/ScoreSparkline";
import { useJob } from "@/api/hooks/useJobs";
import { useExportTake, exportDownloadUrl } from "@/api/hooks/useExports";
import { usePresets } from "@/api/hooks/usePresets";
import { useBestTwoMin } from "@/api/hooks/useAnalysis";
import { takeAudioUrl } from "@/api/hooks/useTakes";
import { ApiError } from "@/api/client";
import { tFallback } from "@/lib/labels";
import type { BestTwoMinResult, Take } from "@/api/types";

function extractFilename(result: unknown): string | null {
  if (result && typeof result === "object" && "filename" in result) {
    const filename = (result as { filename?: unknown }).filename;
    return typeof filename === "string" ? filename : null;
  }
  return null;
}

function extractBestTwoMin(result: unknown): BestTwoMinResult | null {
  if (result && typeof result === "object" && "start_s" in result && "end_s" in result) {
    return result as BestTwoMinResult;
  }
  return null;
}

export function ExportDialog({ take, trigger }: { take: Take; trigger: React.ReactNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState<string>(take.processed[0]?.chain_hash ?? "raw");
  const [format, setFormat] = useState("wav");
  const [preset, setPreset] = useState<string>("__none__");
  const [rangeMode, setRangeMode] = useState<"full" | "custom">("full");
  const [start, setStart] = useState("0");
  const [end, setEnd] = useState(String(Math.round(take.duration_s)));
  const [jobId, setJobId] = useState<string | undefined>();
  const [best2minJobId, setBest2minJobId] = useState<string | undefined>();
  const [bestWindow, setBestWindow] = useState<WaveformRegion | null>(null);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [perWindow, setPerWindow] = useState<BestTwoMinResult["per_window"] | null>(null);
  const waveformRef = useRef<WaveformPlayerHandle>(null);

  const presetsQuery = usePresets();
  const exportMutation = useExportTake(take.id);
  const best2min = useBestTwoMin(take.id);
  const { data: job } = useJob(jobId);
  const { data: best2minJob } = useJob(best2minJobId);
  const filename = extractFilename(job?.result);
  const best2minRunning = best2min.isPending || best2minJob?.status === "queued" || best2minJob?.status === "running";

  useEffect(() => {
    if (!best2minJob) return;
    if (best2minJob.status === "done") {
      const result = extractBestTwoMin(best2minJob.result);
      if (result) {
        setStart(String(Math.round(result.start_s)));
        setEnd(String(Math.round(result.end_s)));
        setRangeMode("custom");
        setBestWindow({ start: result.start_s, end: result.end_s });
        setBestScore(result.score);
        setPerWindow(result.per_window);
      }
    } else if (best2minJob.status === "error") {
      toast.error(tFallback(t, best2minJob.error?.message_key, best2minJob.error?.code));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [best2minJob?.status]);

  const handleBestTwoMin = () => {
    setBestWindow(null);
    setBestScore(null);
    setPerWindow(null);
    best2min.mutate(variant, {
      onSuccess: (res) => setBest2minJobId(res.job_id),
      onError: (err) => {
        if (err instanceof ApiError && err.status === 404) {
          toast.error(t("record.best2min.unavailable"));
          return;
        }
        const message = err instanceof ApiError ? tFallback(t, err.messageKey) : t("errors.unknown");
        toast.error(message);
      },
    });
  };

  const handleRegionChange = (region: WaveformRegion) => {
    setBestWindow(region);
    setStart(String(Math.round(region.start)));
    setEnd(String(Math.round(region.end)));
    setRangeMode("custom");
  };

  const handleSubmit = () => {
    exportMutation.mutate(
      {
        variant,
        format,
        preset: preset === "__none__" ? undefined : preset,
        range_start_s: rangeMode === "custom" ? Number(start) : undefined,
        range_end_s: rangeMode === "custom" ? Number(end) : undefined,
      },
      {
        onSuccess: (res) => setJobId(res.job_id),
        onError: (err) => {
          const message = err instanceof ApiError ? tFallback(t, err.messageKey) : t("errors.unknown");
          toast.error(message);
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setJobId(undefined);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("project.export.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("project.export.variant_label")}</Label>
            <Select value={variant} onValueChange={setVariant}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="raw">{t("project.audio.variant.raw")}</SelectItem>
                {take.processed.map((p) => (
                  <SelectItem key={p.chain_hash} value={p.chain_hash}>
                    {t("project.audio.variant.processed")} · {p.chain_hash.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("project.export.format_label")}</Label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wav">WAV</SelectItem>
                  <SelectItem value="mp3">MP3</SelectItem>
                  <SelectItem value="flac">FLAC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("project.export.preset_label")}</Label>
              <Select value={preset} onValueChange={setPreset}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("common.none")}</SelectItem>
                  {(presetsQuery.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {tFallback(t, p.name_key, p.id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-border bg-card/60 p-3">
            <WaveformPlayer
              ref={waveformRef}
              src={takeAudioUrl(take.id, variant)}
              compact
              region={bestWindow}
              onRegionChange={handleRegionChange}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleBestTwoMin}
                disabled={best2minRunning}
                className="gap-1.5"
              >
                <Sparkles className="size-3.5" />
                {best2minRunning ? t("record.best2min.running") : t("record.best2min.button")}
              </Button>
              {bestScore !== null && (
                <span className="font-numeric text-xs text-muted-foreground">
                  {t("record.best2min.score_label")}: {bestScore.toFixed(2)}
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">{t("record.best2min.hint")}</p>
            {best2minRunning && best2minJobId && <JobProgressBar jobId={best2minJobId} />}
            {perWindow && (
              <ScoreSparkline data={perWindow} highlightStart={bestWindow?.start} highlightEnd={bestWindow?.end} />
            )}
          </div>

          <div className="space-y-1.5">
            <Label>{t("project.export.range_label")}</Label>
            <ToggleGroup
              type="single"
              value={rangeMode}
              onValueChange={(v) => v && setRangeMode(v as "full" | "custom")}
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="full">{t("project.export.range_full")}</ToggleGroupItem>
              <ToggleGroupItem value="custom">{t("project.export.range_custom")}</ToggleGroupItem>
            </ToggleGroup>
            {rangeMode === "custom" && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t("project.export.start_label")}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    className="font-numeric"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t("project.export.end_label")}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    className="font-numeric"
                  />
                </div>
              </div>
            )}
          </div>

          {jobId && <JobProgressBar jobId={jobId} />}

          {filename && (
            <Button asChild variant="secondary" className="w-full">
              <a href={exportDownloadUrl(filename)} download>
                <Download /> {t("project.export.download_button")}
              </a>
            </Button>
          )}
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={exportMutation.isPending || Boolean(filename)}>
            {exportMutation.isPending ? t("project.export.progress") : t("project.export.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
