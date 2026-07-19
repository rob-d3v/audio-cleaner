import { useTranslation } from "react-i18next";

import { formatDuration } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { BestTwoMinWindow } from "@/api/types";

/**
 * Per-window score heat strip for the best-2-min helper — bars inside the
 * chosen window are highlighted so the user can see *why* that range was
 * picked, at a glance, without reading numbers.
 */
export function ScoreSparkline({
  data,
  highlightStart,
  highlightEnd,
  className,
}: {
  data: BestTwoMinWindow[];
  highlightStart?: number;
  highlightEnd?: number;
  className?: string;
}) {
  const { t } = useTranslation();
  if (data.length === 0) return null;

  const max = Math.max(...data.map((d) => d.score), 0.0001);

  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {t("record.best2min.chart_caption")}
      </p>
      <div className="flex h-8 items-end gap-px rounded-md bg-muted/40 p-1">
        {data.map((d, i) => {
          const heightPct = Math.max(6, (d.score / max) * 100);
          const inWindow =
            highlightStart !== undefined && highlightEnd !== undefined && d.start_s >= highlightStart && d.start_s < highlightEnd;
          return (
            <div
              key={i}
              title={`${formatDuration(d.start_s)} · ${d.score.toFixed(2)}`}
              className={cn(
                "min-w-px flex-1 rounded-[1px] transition-colors",
                inWindow ? "bg-primary" : "bg-muted-foreground/30",
              )}
              style={{ height: `${heightPct}%` }}
            />
          );
        })}
      </div>
    </div>
  );
}
