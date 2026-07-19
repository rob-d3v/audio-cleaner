import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NewProjectDialog } from "@/components/library/NewProjectDialog";
import { useProjects } from "@/api/hooks/useProjects";

export function ProjectSelector({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (projectId: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const projectsQuery = useProjects({});
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  return (
    <div className="space-y-1.5">
      <Label>{t("record.project_label")}</Label>
      <div className="flex gap-2">
        <Select value={value ?? undefined} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("record.project_placeholder")} />
          </SelectTrigger>
          <SelectContent>
            {(projectsQuery.data ?? []).map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          title={t("record.project_create_quick")}
          onClick={() => setQuickCreateOpen(true)}
          disabled={disabled}
        >
          <Plus />
        </Button>
      </div>
      <NewProjectDialog
        open={quickCreateOpen}
        onOpenChange={setQuickCreateOpen}
        navigateOnCreate={false}
        onCreated={(project) => onChange(project.id)}
      />
    </div>
  );
}
