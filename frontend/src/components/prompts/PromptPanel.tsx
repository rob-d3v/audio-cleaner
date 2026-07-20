import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TemplatePicker, NO_TEMPLATE } from "@/components/prompts/TemplatePicker";
import { VariableForm } from "@/components/prompts/VariableForm";
import { usePromptTemplates, useRenderPromptTemplate } from "@/api/hooks/useTemplates";
import { useProjectPromptHistory, useProjectPrompts, usePutProjectPrompt } from "@/api/hooks/usePrompts";
import { formatDateTime } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { PromptKind, PromptTemplateKind } from "@/api/types";

const RENDER_DEBOUNCE_MS = 400;
const STYLE_CHAR_WARNING = 1000;

export function PromptPanel({
  projectId,
  promptKind,
  templateKind,
  titleKey,
}: {
  projectId: string;
  promptKind: PromptKind;
  templateKind: PromptTemplateKind;
  titleKey: string;
}) {
  const { t, i18n } = useTranslation();
  const promptsQuery = useProjectPrompts(projectId);
  const historyQuery = useProjectPromptHistory(projectId, promptKind);
  const templatesQuery = usePromptTemplates(templateKind);
  const renderTemplate = useRenderPromptTemplate();
  const savePrompt = usePutProjectPrompt(projectId, promptKind);

  const [templateId, setTemplateId] = useState<string>(NO_TEMPLATE);
  const [variableValues, setVariableValues] = useState<Record<string, unknown>>({});
  const [text, setText] = useState("");
  const initialized = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (promptsQuery.data && !initialized.current) {
      const current = promptKind === "style" ? promptsQuery.data.style.current : promptsQuery.data.lyrics_prompt.current;
      setText(current?.text ?? "");
      if (current?.template_id) setTemplateId(current.template_id);
      if (current?.variables) setVariableValues(current.variables);
      initialized.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptsQuery.data]);

  const selectedTemplate = templatesQuery.data?.find((tpl) => tpl.id === templateId) ?? null;

  const handleTemplateChange = (id: string) => {
    setTemplateId(id);
    if (id === NO_TEMPLATE) return;
    const tpl = templatesQuery.data?.find((t2) => t2.id === id);
    if (!tpl) return;
    const defaults: Record<string, unknown> = {};
    for (const variable of tpl.variables) {
      if (variable.default !== undefined) defaults[variable.name] = variable.default;
    }
    setVariableValues(defaults);
  };

  const handleVariableChange = (name: string, value: unknown) => {
    setVariableValues((prev) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    if (templateId === NO_TEMPLATE) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      renderTemplate.mutate(
        { template_id: templateId, variables: variableValues },
        { onSuccess: (res) => setText(res.text) },
      );
    }, RENDER_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, variableValues]);

  const handleCopy = () => {
    void navigator.clipboard.writeText(text).then(() => toast.success(t("project.prompts.copied")));
  };

  const handleSave = () => {
    savePrompt.mutate(
      {
        text,
        template_id: templateId !== NO_TEMPLATE ? templateId : undefined,
        variables: templateId !== NO_TEMPLATE ? variableValues : undefined,
      },
      { onSuccess: () => toast.success(t("project.prompts.saved_to_project")) },
    );
  };

  const charCount = text.length;
  const showCharWarning = promptKind === "style" && charCount > STYLE_CHAR_WARNING;

  return (
    <div className="space-y-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <h3 className="font-heading text-sm font-semibold text-foreground">{t(titleKey)}</h3>

      <div className="space-y-1.5">
        <Label>{t("project.prompts.template_label")}</Label>
        <TemplatePicker kind={templateKind} value={templateId} onChange={handleTemplateChange} />
      </div>

      {selectedTemplate && selectedTemplate.variables.length > 0 && (
        <div className="space-y-1.5">
          <Label>{t("project.prompts.variables_title")}</Label>
          <VariableForm
            variables={selectedTemplate.variables}
            values={variableValues}
            onChange={handleVariableChange}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>{t("project.prompts.preview_title")}</Label>
          <span className={cn("font-numeric text-xs", showCharWarning ? "text-caution" : "text-muted-foreground")}>
            {t("project.prompts.char_count", { count: charCount })}
          </span>
        </div>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-32 resize-none leading-relaxed"
          placeholder={t("project.prompts.preview_empty")}
        />
        {showCharWarning && <p className="text-xs text-caution">{t("project.prompts.char_count_warning")}</p>}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleCopy} disabled={!text}>
          <Copy /> {t("project.prompts.copy")}
        </Button>
        <Button size="sm" onClick={handleSave} disabled={savePrompt.isPending || !text}>
          {t("project.prompts.save_to_project")}
        </Button>
      </div>

      <div className="space-y-1.5 border-t border-border pt-3">
        <Label className="text-xs text-muted-foreground">{t("project.prompts.history_title")}</Label>
        {(historyQuery.data ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("project.prompts.history_empty")}</p>
        ) : (
          <ScrollArea className="max-h-40">
            <div className="space-y-1 pr-2">
              {(historyQuery.data ?? []).map((entry) => (
                <button
                  key={entry.ts}
                  type="button"
                  onClick={() => {
                    setTemplateId(NO_TEMPLATE);
                    setText(entry.text);
                  }}
                  className="block w-full rounded-md p-1.5 text-left text-xs hover:bg-muted"
                >
                  <p className="font-numeric text-muted-foreground">{formatDateTime(entry.created_at, i18n.language)}</p>
                  <p className="truncate text-foreground">{entry.text}</p>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
