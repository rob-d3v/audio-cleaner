import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Mic } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { TakeRow } from "@/components/player/TakeRow";
import { useTakes } from "@/api/hooks/useTakes";
import type { ProjectMode } from "@/api/types";

export function AudioTab({ projectId, mode }: { projectId: string; mode: ProjectMode }) {
  const { t } = useTranslation();
  const takesQuery = useTakes(projectId);
  const takes = takesQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-sm font-semibold text-foreground">{t("project.audio.takes_title")}</h2>
        <Button variant="outline" size="sm" asChild>
          <Link to={`/record?project=${projectId}`}>
            <Mic /> {t("project.audio.record_new")}
          </Link>
        </Button>
      </div>

      {takesQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : takes.length === 0 ? (
        <EmptyState
          title={t("project.audio.no_takes.title")}
          description={t("project.audio.no_takes.description")}
          action={
            <Button variant="outline" asChild>
              <Link to={`/record?project=${projectId}`}>
                <Mic /> {t("project.audio.record_new")}
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {takes.map((take) => (
            <TakeRow key={take.id} take={take} projectId={projectId} mode={mode} />
          ))}
        </div>
      )}
    </div>
  );
}
