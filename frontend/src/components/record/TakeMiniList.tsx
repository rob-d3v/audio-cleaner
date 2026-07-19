import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { WaveformPlayer } from "@/components/player/WaveformPlayer";
import { useTakes, takeAudioUrl } from "@/api/hooks/useTakes";
import { formatDuration } from "@/lib/labels";

export function TakeMiniList({ projectId, takeIds }: { projectId: string; takeIds: string[] }) {
  const { t } = useTranslation();
  const takesQuery = useTakes(projectId);
  const takes = (takesQuery.data ?? []).filter((take) => takeIds.includes(take.id));

  if (takeIds.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("record.takes_empty")}</p>;
  }

  return (
    <div className="space-y-2">
      {takes.map((take) => (
        <div key={take.id} className="flex items-center gap-3 rounded-lg bg-card p-3 ring-1 ring-foreground/10">
          <WaveformPlayer src={takeAudioUrl(take.id, "raw")} compact className="min-w-0 flex-1" />
          <span className="font-numeric shrink-0 text-xs text-muted-foreground">
            {formatDuration(take.duration_s)}
          </span>
          <Button variant="ghost" size="sm" asChild className="shrink-0">
            <Link to={`/project/${projectId}`}>
              {t("record.open_in_project")} <ArrowUpRight />
            </Link>
          </Button>
        </div>
      ))}
    </div>
  );
}
