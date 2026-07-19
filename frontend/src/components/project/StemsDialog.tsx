import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Guitar, MicVocal, Sliders, Split } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { WaveformPlayer } from "@/components/player/WaveformPlayer";
import { JobProgressBar } from "@/components/shared/JobProgressBar";
import { ProcessDialog } from "@/components/pipeline/ProcessDialog";
import { useTakeStems, useSeparateTake, stemAudioUrl } from "@/api/hooks/useAnalysis";
import { useJob } from "@/api/hooks/useJobs";
import { useSystemCapabilities } from "@/api/hooks/useSystem";
import { queryKeys } from "@/api/queryKeys";
import { ApiError } from "@/api/client";
import { tFallback } from "@/lib/labels";

export function StemsDialog({
  takeId,
  projectId,
  trigger,
}: {
  takeId: string;
  projectId: string;
  trigger: React.ReactNode;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [jobId, setJobId] = useState<string | undefined>();

  const capsQuery = useSystemCapabilities();
  const stemsQuery = useTakeStems(open ? takeId : undefined);
  const separateTake = useSeparateTake(takeId);
  const { data: job } = useJob(jobId);

  const running = separateTake.isPending || job?.status === "queued" || job?.status === "running";
  const stems = stemsQuery.data;
  const capabilityMissing = capsQuery.data ? !capsQuery.data.separate : false;

  useEffect(() => {
    if (!job) return;
    if (job.status === "done") {
      qc.invalidateQueries({ queryKey: queryKeys.takeStems(takeId) });
    } else if (job.status === "error") {
      toast.error(tFallback(t, job.error?.message_key, job.error?.code));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.status]);

  const handleSeparate = () => {
    separateTake.mutate(undefined, {
      onSuccess: (res) => setJobId(res.job_id),
      onError: (err) => {
        if (err instanceof ApiError && err.status === 404) {
          toast.error(t("project.stems.unavailable"));
          return;
        }
        const message = err instanceof ApiError ? tFallback(t, err.messageKey) : t("errors.unknown");
        toast.error(message);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("project.stems.title")}</DialogTitle>
        </DialogHeader>

        {!stems ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {stemsQuery.isLoading ? t("common.loading") : t("project.stems.empty")}
            </p>
            {capabilityMissing && <p className="text-xs text-caution">{t("project.stems.capability_missing")}</p>}
            <Button type="button" onClick={handleSeparate} disabled={running} className="gap-1.5">
              <Split className="size-3.5" />
              {running ? t("project.stems.running") : t("project.stems.separate_button")}
            </Button>
            {jobId && running && <JobProgressBar jobId={jobId} />}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2 rounded-lg border border-border bg-card/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <MicVocal className="size-4 text-primary" /> {t("project.stems.vocals")}
                </p>
                <ProcessDialog
                  takeId={takeId}
                  projectId={projectId}
                  source="vocals"
                  title={`${t("project.stems.vocals")} · ${t("project.pipeline.title")}`}
                  trigger={
                    <Button variant="outline" size="sm">
                      <Sliders /> {t("project.stems.process_stem")}
                    </Button>
                  }
                />
              </div>
              <WaveformPlayer src={stemAudioUrl(takeId, "vocals")} compact />
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-card/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <Guitar className="size-4 text-primary" /> {t("project.stems.instrumental")}
                </p>
                <ProcessDialog
                  takeId={takeId}
                  projectId={projectId}
                  source="instrumental"
                  title={`${t("project.stems.instrumental")} · ${t("project.pipeline.title")}`}
                  trigger={
                    <Button variant="outline" size="sm">
                      <Sliders /> {t("project.stems.process_stem")}
                    </Button>
                  }
                />
              </div>
              <WaveformPlayer src={stemAudioUrl(takeId, "instrumental")} compact />
            </div>

            <Button type="button" variant="ghost" size="sm" onClick={handleSeparate} disabled={running} className="gap-1.5">
              <Split className="size-3.5" /> {t("project.stems.separate_button")}
            </Button>
            {jobId && running && <JobProgressBar jobId={jobId} />}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
