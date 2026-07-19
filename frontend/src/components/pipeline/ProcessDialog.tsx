import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PipelinePanel } from "@/components/pipeline/PipelinePanel";

export function ProcessDialog({
  takeId,
  projectId,
  trigger,
  source,
  title,
}: {
  takeId: string;
  projectId: string;
  trigger: React.ReactNode;
  /** Audio source to process — "raw", a processed chain_hash, or a stem name. */
  source?: string;
  title?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title ?? t("project.pipeline.title")}</DialogTitle>
        </DialogHeader>
        {open && <PipelinePanel takeId={takeId} projectId={projectId} source={source} />}
      </DialogContent>
    </Dialog>
  );
}
