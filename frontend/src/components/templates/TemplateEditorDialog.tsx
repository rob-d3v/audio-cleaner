import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreatePromptTemplate } from "@/api/hooks/useTemplates";
import { ApiError } from "@/api/client";
import { tFallback } from "@/lib/labels";
import type { PromptTemplateKind, PromptTemplateVariable } from "@/api/types";

interface DraftVariable {
  key: string;
  name: string;
  label: string;
  type: PromptTemplateVariable["type"];
  options: string;
  required: boolean;
}

function newDraftVariable(): DraftVariable {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: "",
    label: "",
    type: "string",
    options: "",
    required: false,
  };
}

export function TemplateEditorDialog({
  trigger,
  defaultKind,
}: {
  trigger: React.ReactNode;
  defaultKind: PromptTemplateKind;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<PromptTemplateKind>(defaultKind);
  const [template, setTemplate] = useState("");
  const [variables, setVariables] = useState<DraftVariable[]>([]);
  const createTemplate = useCreatePromptTemplate();

  const reset = () => {
    setName("");
    setKind(defaultKind);
    setTemplate("");
    setVariables([]);
  };

  const updateVariable = (key: string, patch: Partial<DraftVariable>) => {
    setVariables((prev) => prev.map((v) => (v.key === key ? { ...v, ...patch } : v)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !template.trim()) return;
    const payloadVariables: PromptTemplateVariable[] = variables
      .filter((v) => v.name.trim())
      .map((v) => ({
        name: v.name.trim(),
        label_key: v.label.trim() || v.name.trim(),
        type: v.type,
        required: v.required,
        options:
          v.type === "select" || v.type === "multiselect"
            ? v.options.split(",").map((o) => o.trim()).filter(Boolean)
            : undefined,
      }));

    createTemplate.mutate(
      { kind, name: name.trim(), template, variables: payloadVariables },
      {
        onSuccess: () => {
          setOpen(false);
          reset();
        },
        onError: (err) => {
          const message = err instanceof ApiError ? tFallback(t, err.messageKey) : t("errors.unknown");
          toast.error(message);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("templates.editor.title_new")}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{t("templates.editor.name_label")}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("templates.editor.name_placeholder")} />
            </div>
            <div className="space-y-1">
              <Label>{t("templates.editor.kind_label")}</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as PromptTemplateKind)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="style">{t("templates.kind.style")}</SelectItem>
                  <SelectItem value="lyrics">{t("templates.kind.lyrics")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>{t("templates.editor.template_label")}</Label>
            <Textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="min-h-28 resize-none"
            />
            <p className="text-xs text-muted-foreground">{t("templates.editor.template_hint")}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("templates.editor.variables_label")}</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => setVariables((prev) => [...prev, newDraftVariable()])}>
                <Plus /> {t("templates.editor.variable_add")}
              </Button>
            </div>
            {variables.map((variable) => (
              <div key={variable.key} className="grid grid-cols-[1fr_1fr_auto_auto_auto] items-end gap-2 rounded-lg border border-border p-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">{t("templates.editor.variable_name")}</Label>
                  <Input
                    value={variable.name}
                    onChange={(e) => updateVariable(variable.key, { name: e.target.value })}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">{t("templates.editor.variable_label")}</Label>
                  <Input
                    value={variable.label}
                    onChange={(e) => updateVariable(variable.key, { label: e.target.value })}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">{t("templates.editor.variable_type")}</Label>
                  <Select value={variable.type} onValueChange={(v) => updateVariable(variable.key, { type: v as DraftVariable["type"] })}>
                    <SelectTrigger size="sm" className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="string">{t("templates.editor.variable_type_string")}</SelectItem>
                      <SelectItem value="select">{t("templates.editor.variable_type_select")}</SelectItem>
                      <SelectItem value="multiselect">{t("templates.editor.variable_type_multiselect")}</SelectItem>
                      <SelectItem value="number">{t("templates.editor.variable_type_number")}</SelectItem>
                      <SelectItem value="boolean">{t("templates.editor.variable_type_boolean")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-1 pb-1.5 text-[10px] text-muted-foreground">
                  <Checkbox
                    checked={variable.required}
                    onCheckedChange={(checked) => updateVariable(variable.key, { required: Boolean(checked) })}
                  />
                  {t("templates.editor.variable_required")}
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-alert"
                  onClick={() => setVariables((prev) => prev.filter((v) => v.key !== variable.key))}
                >
                  <Trash2 />
                </Button>
                {(variable.type === "select" || variable.type === "multiselect") && (
                  <div className="col-span-5 space-y-1">
                    <Label className="text-[10px] text-muted-foreground">{t("templates.editor.variable_options")}</Label>
                    <Input
                      value={variable.options}
                      onChange={(e) => updateVariable(variable.key, { options: e.target.value })}
                      className="h-7 text-xs"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={!name.trim() || !template.trim() || createTemplate.isPending}>
              {t("templates.editor.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
