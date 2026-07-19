import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_BADGE_CLASS, STATUS_DOT_CLASS } from "@/lib/status";
import type { ProjectStatus } from "@/api/types";

export function StatusBadge({ status, className }: { status: ProjectStatus; className?: string }) {
  const { t } = useTranslation();
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 font-medium", STATUS_BADGE_CLASS[status], className)}
    >
      <span className={cn("size-1.5 rounded-full", STATUS_DOT_CLASS[status])} />
      {t(`status.${status}`)}
    </Badge>
  );
}
