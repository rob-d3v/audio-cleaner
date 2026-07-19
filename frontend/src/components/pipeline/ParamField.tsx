import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { humanize } from "@/lib/labels";
import type { ParamSchemaProperty } from "@/api/types";

export function ParamField({
  paramKey,
  schema,
  value,
  onChange,
  disabled,
}: {
  paramKey: string;
  schema: ParamSchemaProperty;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}) {
  const label = schema.title ?? humanize(paramKey);
  const fieldId = `param-${paramKey}`;

  if (schema.type === "boolean") {
    return (
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={fieldId} className="text-xs font-normal text-foreground">
          {label}
        </Label>
        <Switch
          id={fieldId}
          checked={Boolean(value)}
          onCheckedChange={onChange}
          disabled={disabled}
        />
      </div>
    );
  }

  if (schema.enum && schema.enum.length > 0) {
    const currentValue = String(value ?? schema.default ?? schema.enum[0]);
    return (
      <div className="space-y-1">
        <Label htmlFor={fieldId} className="text-xs font-normal text-foreground">
          {label}
        </Label>
        <Select value={currentValue} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger id={fieldId} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {schema.enum.map((opt) => (
              <SelectItem key={String(opt)} value={String(opt)}>
                {schema["x-enum-labels"]?.[String(opt)] ?? humanize(String(opt))}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (schema.type === "number" || schema.type === "integer") {
    const min = schema.minimum ?? 0;
    const max = schema.maximum ?? 100;
    const step = schema.multipleOf ?? (schema.type === "integer" ? 1 : (max - min) / 100 || 0.1);
    const numericValue = typeof value === "number" ? value : Number(schema.default ?? min);
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor={fieldId} className="text-xs font-normal text-foreground">
            {label}
          </Label>
          <span className="font-numeric text-xs text-muted-foreground">{numericValue}</span>
        </div>
        <Slider
          id={fieldId}
          value={[numericValue]}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onValueChange={([v]) => onChange(v)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label htmlFor={fieldId} className="text-xs font-normal text-foreground">
        {label}
      </Label>
      <Input
        id={fieldId}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}
