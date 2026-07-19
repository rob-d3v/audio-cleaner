import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateProject } from "@/api/hooks/useProjects";
import { ApiError } from "@/api/client";
import { tFallback } from "@/lib/labels";
import type { Project, ProjectMode } from "@/api/types";

export function NewProjectDialog({
  trigger,
  open,
  onOpenChange,
  navigateOnCreate = true,
  onCreated,
}: {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** When false, stays on the current page instead of navigating to the new project. */
  navigateOnCreate?: boolean;
  onCreated?: (project: Project) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [internalOpen, setInternalOpen] = useState(false);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<ProjectMode>("voice");
  const createProject = useCreateProject();

  const isOpen = open ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createProject.mutate(
      { name: name.trim(), mode },
      {
        onSuccess: (project) => {
          setOpen(false);
          setName("");
          setMode("voice");
          onCreated?.(project);
          if (navigateOnCreate) navigate(`/project/${project.id}`);
        },
        onError: (err) => {
          const message = err instanceof ApiError ? tFallback(t, err.messageKey) : t("errors.unknown");
          toast.error(message);
        },
      },
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("library.project_dialog.title")}</DialogTitle>
            <DialogDescription>{t("library.project_dialog.description")}</DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-project-name">{t("library.project_dialog.name_label")}</Label>
              <Input
                id="new-project-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("library.project_dialog.name_placeholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-project-mode">{t("library.project_dialog.mode_label")}</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as ProjectMode)}>
                <SelectTrigger id="new-project-mode" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="voice">{t("library.project_dialog.mode.voice")}</SelectItem>
                  <SelectItem value="voice_guitar">{t("library.project_dialog.mode.voice_guitar")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!name.trim() || createProject.isPending}>
              {createProject.isPending ? t("common.saving") : t("library.project_dialog.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
