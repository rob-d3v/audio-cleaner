import { useTranslation } from "react-i18next";

import { useJob } from "@/api/hooks/useJobs";
import { Progress } from "@/components/ui/progress";
import { tFallback } from "@/lib/labels";
import { cn } from "@/lib/utils";

function normalizeProgress(progress: number | undefined): number {
  if (!Number.isFinite(progress)) return 0;
  const value = progress as number;
  const pct = value <= 1 ? value * 100 : value;
  return Math.min(100, Math.max(0, Math.round(pct)));
}

export function JobProgressBar({ jobId, className }: { jobId: string | undefined; className?: string }) {
  const { t } = useTranslation();
  const { data: job } = useJob(jobId);
  if (!job) return null;

  const pct = normalizeProgress(job.progress);
  const message = job.message_key ? tFallback(t, job.message_key) : job.stage;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between text-xs">
        <span
          className={cn(
            "font-medium",
            job.status === "error" && "text-alert",
            job.status === "done" && "text-primary",
          )}
        >
          {t(`jobs.status.${job.status}`)}
        </span>
        <span className="font-numeric text-muted-foreground">{pct}%</span>
      </div>
      <Progress value={pct} className={job.status === "error" ? "[&>div]:bg-alert" : undefined} />
      {message && job.status === "running" && <p className="truncate text-xs text-muted-foreground">{message}</p>}
      {job.error && (
        <p className="text-xs text-alert">{tFallback(t, job.error.message_key, job.error.code)}</p>
      )}
    </div>
  );
}
