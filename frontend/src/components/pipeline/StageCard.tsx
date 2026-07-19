import { useTranslation } from "react-i18next";
import { Lock } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ParamField } from "@/components/pipeline/ParamField";
import { tFallback } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { PipelineStage } from "@/api/types";

export function StageCard({
  stage,
  enabled,
  params,
  onToggle,
  onParamChange,
}: {
  stage: PipelineStage;
  enabled: boolean;
  params: Record<string, unknown>;
  onToggle: (enabled: boolean) => void;
  onParamChange: (key: string, value: unknown) => void;
}) {
  const { t } = useTranslation();
  const properties = Object.entries(stage.params_schema?.properties ?? {});

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card/60 p-3 transition-colors",
        enabled && stage.available && "border-primary/30 bg-primary/[0.03]",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">
              {tFallback(t, stage.name_key, stage.id)}
            </p>
            {!stage.available && (
              <Badge variant="outline" className="gap-1 border-alert/30 text-alert">
                <Lock className="size-3" />
                {t("common.locked")}
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">{tFallback(t, `stages.category.${stage.category}`, stage.category)}</p>
        </div>
        <Switch
          checked={enabled && stage.available}
          onCheckedChange={onToggle}
          disabled={!stage.available}
        />
      </div>
      {!stage.available && (
        <p className="mt-2 text-xs text-muted-foreground">{t("project.pipeline.stage_requires_extra")}</p>
      )}
      {enabled && stage.available && properties.length > 0 && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          {properties.map(([key, schema]) => (
            <ParamField
              key={key}
              paramKey={key}
              schema={schema}
              value={params[key] ?? stage.defaults?.[key] ?? schema.default}
              onChange={(value) => onParamChange(key, value)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
