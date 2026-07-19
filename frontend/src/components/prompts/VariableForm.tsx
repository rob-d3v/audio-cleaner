import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { tFallback, humanize } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { PromptTemplateVariable } from "@/api/types";

function normalizeOptions(
  options: PromptTemplateVariable["options"],
  t: TFunction,
): { value: string; label: string }[] {
  if (!options) return [];
  return options.map((opt) =>
    typeof opt === "string"
      ? { value: opt, label: opt }
      : { value: opt.value, label: opt.label_key ? tFallback(t, opt.label_key, opt.value) : opt.value },
  );
}

export function VariableForm({
  variables,
  values,
  onChange,
}: {
  variables: PromptTemplateVariable[];
  values: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
}) {
  const { t } = useTranslation();

  if (variables.length === 0) return null;

  return (
    <div className="space-y-3">
      {variables.map((variable) => {
        const label = tFallback(t, variable.label_key, variable.name) || humanize(variable.name);
        const fieldId = `var-${variable.name}`;

        if (variable.type === "boolean") {
          return (
            <div key={variable.name} className="flex items-center justify-between gap-3">
              <Label htmlFor={fieldId} className="text-xs font-normal text-foreground">
                {label}
              </Label>
              <Switch
                id={fieldId}
                checked={Boolean(values[variable.name])}
                onCheckedChange={(v) => onChange(variable.name, v)}
              />
            </div>
          );
        }

        if (variable.type === "number") {
          return (
            <div key={variable.name} className="space-y-1">
              <Label htmlFor={fieldId} className="text-xs font-normal text-foreground">
                {label}
              </Label>
              <Input
                id={fieldId}
                type="number"
                className="font-numeric"
                value={values[variable.name] === undefined ? "" : String(values[variable.name])}
                onChange={(e) => onChange(variable.name, e.target.value === "" ? undefined : Number(e.target.value))}
              />
            </div>
          );
        }

        if (variable.type === "select") {
          const options = normalizeOptions(variable.options, t);
          return (
            <div key={variable.name} className="space-y-1">
              <Label htmlFor={fieldId} className="text-xs font-normal text-foreground">
                {label}
              </Label>
              <Select
                value={values[variable.name] ? String(values[variable.name]) : undefined}
                onValueChange={(v) => onChange(variable.name, v)}
              >
                <SelectTrigger id={fieldId} className="w-full">
                  <SelectValue placeholder={t("common.select_placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  {options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        }

        if (variable.type === "multiselect") {
          const options = normalizeOptions(variable.options, t);
          const current = Array.isArray(values[variable.name]) ? (values[variable.name] as string[]) : [];
          const toggle = (val: string) => {
            const next = current.includes(val) ? current.filter((v) => v !== val) : [...current, val];
            onChange(variable.name, next);
          };
          return (
            <div key={variable.name} className="space-y-1.5">
              <Label className="text-xs font-normal text-foreground">{label}</Label>
              <div className="flex flex-wrap gap-1.5">
                {options.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggle(opt.value)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs transition-colors",
                      current.includes(opt.value)
                        ? "border-primary/40 bg-primary/15 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          );
        }

        return (
          <div key={variable.name} className="space-y-1">
            <Label htmlFor={fieldId} className="text-xs font-normal text-foreground">
              {label}
              {variable.required && <span className="text-alert"> *</span>}
            </Label>
            <Input
              id={fieldId}
              value={values[variable.name] === undefined ? "" : String(values[variable.name])}
              onChange={(e) => onChange(variable.name, e.target.value)}
            />
          </div>
        );
      })}
    </div>
  );
}
