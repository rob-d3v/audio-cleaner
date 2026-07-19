import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { JobProgressBar } from "@/components/shared/JobProgressBar";
import { useJob } from "@/api/hooks/useJobs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractImportResult(result: unknown): {
  createdProjects: { id: string; name: string }[];
  skippedCount: number;
} {
  const createdProjects: { id: string; name: string }[] = [];
  let skippedCount = 0;
  if (isRecord(result)) {
    if (Array.isArray(result.created)) {
      for (const entry of result.created) {
        if (isRecord(entry) && typeof entry.id === "string") {
          createdProjects.push({ id: entry.id, name: typeof entry.name === "string" ? entry.name : entry.id });
        }
      }
    } else if (Array.isArray(result.created_project_ids)) {
      for (const id of result.created_project_ids) {
        if (typeof id === "string") createdProjects.push({ id, name: id });
      }
    }
    if (typeof result.skipped === "number") skippedCount = result.skipped;
    else if (Array.isArray(result.skipped)) skippedCount = result.skipped.length;
  }
  return { createdProjects, skippedCount };
}

export function ExecuteStep({
  itemCount,
  copyOriginals,
  onCopyOriginalsChange,
  jobId,
  onExecute,
  executing,
}: {
  itemCount: number;
  copyOriginals: boolean;
  onCopyOriginalsChange: (value: boolean) => void;
  jobId: string | undefined;
  onExecute: () => void;
  executing: boolean;
}) {
  const { t } = useTranslation();
  const { data: job } = useJob(jobId);
  const isDone = job?.status === "done";
  const { createdProjects, skippedCount } = extractImportResult(job?.result);

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">{t("import.step3.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("import.step3.description")}</p>
      </div>

      {!jobId && (
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox
              checked={copyOriginals}
              onCheckedChange={(checked) => onCopyOriginalsChange(Boolean(checked))}
            />
            {t("import.step3.copy_originals")}
          </label>
          <Button onClick={onExecute} disabled={executing || itemCount === 0}>
            {t("import.step3.execute_button")}
          </Button>
        </div>
      )}

      {jobId && !isDone && (
        <div className="space-y-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-sm text-muted-foreground">{t("import.step3.progress_title")}</p>
          <JobProgressBar jobId={jobId} />
        </div>
      )}

      {isDone && (
        <div className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <p className="flex items-center gap-1.5 font-heading text-sm font-semibold text-primary">
            <CheckCircle2 className="size-4" /> {t("import.step3.done_title")}
          </p>
          <p className="text-sm text-muted-foreground">{t("import.step3.done_description")}</p>
          <div className="flex gap-4 font-numeric text-sm text-foreground">
            <span>{t("import.step3.created_count", { count: createdProjects.length })}</span>
            <span>{t("import.step3.skipped_count", { count: skippedCount })}</span>
          </div>
          {createdProjects.length > 0 && (
            <ul className="space-y-1">
              {createdProjects.map((project) => (
                <li key={project.id}>
                  <Link to={`/project/${project.id}`} className="text-sm text-primary hover:underline">
                    {project.name} — {t("import.step3.view_project")}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
