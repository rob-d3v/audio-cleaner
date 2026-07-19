import { useTranslation } from "react-i18next";
import { Lock } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePromptTemplates } from "@/api/hooks/useTemplates";
import type { PromptTemplateKind } from "@/api/types";

export const NO_TEMPLATE = "__none__";

export function TemplatePicker({
  kind,
  value,
  onChange,
}: {
  kind: PromptTemplateKind;
  value: string;
  onChange: (templateId: string) => void;
}) {
  const { t } = useTranslation();
  const templatesQuery = usePromptTemplates(kind);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_TEMPLATE}>{t("project.prompts.template_none")}</SelectItem>
        {(templatesQuery.data ?? []).map((tpl) => (
          <SelectItem key={tpl.id} value={tpl.id}>
            <span className="flex items-center gap-1.5">
              {tpl.name}
              {tpl.builtin && <Lock className="size-3 text-muted-foreground" />}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
