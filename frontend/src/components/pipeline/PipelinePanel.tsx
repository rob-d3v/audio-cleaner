import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { StageCard } from "@/components/pipeline/StageCard";
import { JobProgressBar } from "@/components/shared/JobProgressBar";
import { usePipelineStages } from "@/api/hooks/usePipeline";
import { usePresets } from "@/api/hooks/usePresets";
import { useProcessTake } from "@/api/hooks/useTakes";
import { useJobEffect } from "@/api/hooks/useJobs";
import { queryKeys } from "@/api/queryKeys";
import { ApiError } from "@/api/client";
import { tFallback } from "@/lib/labels";
import type { PipelineStageConfig } from "@/api/types";

type StageState = Record<string, { enabled: boolean; params: Record<string, unknown> }>;

export function PipelinePanel({
  takeId,
  projectId,
  source = "raw",
}: {
  takeId: string;
  projectId: string;
  /** Audio source to process — "raw", a processed chain_hash, or a stem name (e.g. "vocals"). */
  source?: string;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const stagesQuery = usePipelineStages();
  const presetsQuery = usePresets();
  const processTake = useProcessTake();

  const [stageState, setStageState] = useState<StageState>({});
  const [presetId, setPresetId] = useState<string>("__custom__");
  const [jobId, setJobId] = useState<string | undefined>();

  useEffect(() => {
    if (!stagesQuery.data) return;
    setStageState((prev) => {
      const next: StageState = { ...prev };
      for (const stage of stagesQuery.data) {
        if (!next[stage.id]) {
          next[stage.id] = { enabled: false, params: {} };
        }
      }
      return next;
    });
  }, [stagesQuery.data]);

  const applyPreset = (id: string) => {
    setPresetId(id);
    if (id === "__custom__") return;
    const preset = presetsQuery.data?.find((p) => p.id === id);
    if (!preset) return;
    setStageState((prev) => {
      const next: StageState = { ...prev };
      for (const key of Object.keys(next)) {
        next[key] = { enabled: false, params: next[key].params };
      }
      for (const stageConfig of preset.chain.stages) {
        next[stageConfig.id] = { enabled: stageConfig.enabled, params: stageConfig.params ?? {} };
      }
      return next;
    });
  };

  const handleToggle = (stageId: string, enabled: boolean) => {
    setPresetId("__custom__");
    setStageState((prev) => ({ ...prev, [stageId]: { ...prev[stageId], enabled } }));
  };

  const handleParamChange = (stageId: string, key: string, value: unknown) => {
    setPresetId("__custom__");
    setStageState((prev) => ({
      ...prev,
      [stageId]: { ...prev[stageId], params: { ...prev[stageId]?.params, [key]: value } },
    }));
  };

  const grouped = useMemo(() => {
    const stages = stagesQuery.data ?? [];
    const byCategory = new Map<string, typeof stages>();
    for (const stage of stages) {
      const list = byCategory.get(stage.category) ?? [];
      list.push(stage);
      byCategory.set(stage.category, list);
    }
    return Array.from(byCategory.entries());
  }, [stagesQuery.data]);

  useJobEffect(jobId, (job) => {
    if (job.status === "done") {
      qc.invalidateQueries({ queryKey: queryKeys.takes(projectId) });
      toast.success(t("project.pipeline.job_done"));
    } else if (job.status === "error") {
      toast.error(tFallback(t, job.error?.message_key, job.error?.code));
    }
  });

  const handleProcess = () => {
    const stages: PipelineStageConfig[] = Object.entries(stageState).map(([id, s]) => ({
      id,
      enabled: s.enabled,
      params: s.params,
    }));
    processTake.mutate(
      { takeId, chain: { stages }, source },
      {
        onSuccess: (res) => setJobId(res.job_id),
        onError: (err) => {
          const message = err instanceof ApiError ? tFallback(t, err.messageKey) : t("errors.unknown");
          toast.error(message);
        },
      },
    );
  };

  const isBusy = processTake.isPending;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>{t("project.pipeline.preset_label")}</Label>
        <Select value={presetId} onValueChange={applyPreset}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__custom__">{t("project.pipeline.preset_none")}</SelectItem>
            {(presetsQuery.data ?? []).map((preset) => (
              <SelectItem key={preset.id} value={preset.id}>
                {tFallback(t, preset.name_key, preset.id)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {stagesQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : grouped.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("project.pipeline.no_stages")}</p>
      ) : (
        <ScrollArea className="max-h-[45vh]">
          <div className="space-y-4 pr-3">
            {grouped.map(([category, stages]) => (
              <div key={category} className="space-y-2">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {tFallback(t, `stages.category.${category}`, category)}
                </p>
                <div className="space-y-2">
                  {stages.map((stage) => (
                    <StageCard
                      key={stage.id}
                      stage={stage}
                      enabled={stageState[stage.id]?.enabled ?? false}
                      params={stageState[stage.id]?.params ?? {}}
                      onToggle={(enabled) => handleToggle(stage.id, enabled)}
                      onParamChange={(key, value) => handleParamChange(stage.id, key, value)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {jobId && <JobProgressBar jobId={jobId} />}

      <Button onClick={handleProcess} disabled={isBusy} className="w-full">
        {isBusy ? t("project.pipeline.processing") : t("project.pipeline.process_button")}
      </Button>
    </div>
  );
}
