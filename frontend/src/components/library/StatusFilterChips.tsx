import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import { STATUS_ORDER } from "@/lib/status";
import type { ProjectStatus } from "@/api/types";

export function StatusFilterChips({
  value,
  onChange,
}: {
  value: ProjectStatus | "all";
  onChange: (value: ProjectStatus | "all") => void;
}) {
  const { t } = useTranslation();
  const options: (ProjectStatus | "all")[] = ["all", ...STATUS_ORDER];

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          aria-pressed={value === opt}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            value === opt
              ? "border-primary/40 bg-primary/15 text-primary"
              : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
          )}
        >
          {opt === "all" ? t("library.filters.all") : t(`status.${opt}`)}
        </button>
      ))}
    </div>
  );
}
