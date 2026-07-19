import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Sliders, Download, Split, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ABPlayer } from "@/components/player/ABPlayer";
import { RatingStars } from "@/components/player/RatingStars";
import { ProcessDialog } from "@/components/pipeline/ProcessDialog";
import { ExportDialog } from "@/components/pipeline/ExportDialog";
import { StemsDialog } from "@/components/project/StemsDialog";
import { usePatchTake, useDeleteTake } from "@/api/hooks/useTakes";
import { formatDateTime, formatDuration } from "@/lib/labels";
import type { ProjectMode, Take } from "@/api/types";

export function TakeRow({ take, projectId, mode }: { take: Take; projectId: string; mode?: ProjectMode }) {
  const { t, i18n } = useTranslation();
  const patchTake = usePatchTake(projectId);
  const deleteTake = useDeleteTake(projectId);
  const [sessionLabel, setSessionLabel] = useState(take.session_label ?? "");

  const latestProcessed = take.processed[take.processed.length - 1] ?? null;

  return (
    <div className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{t(`project.audio.origin.${take.origin}`)}</Badge>
          <span className="font-numeric text-xs text-muted-foreground">
            {formatDateTime(take.created_at, i18n.language)}
          </span>
        </div>
        <RatingStars
          value={take.rating}
          onChange={(rating) => patchTake.mutate({ id: take.id, rating })}
        />
      </div>

      <ABPlayer takeId={take.id} processedChainHash={latestProcessed?.chain_hash ?? null} />

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-3 font-numeric">
          <span>{formatDuration(take.duration_s)}</span>
          <span>{take.sample_rate} Hz</span>
          <span>
            {take.channels === 1 ? "mono" : take.channels === 2 ? "stereo" : `${take.channels}ch`}
          </span>
        </div>
        <Input
          value={sessionLabel}
          onChange={(e) => setSessionLabel(e.target.value)}
          onBlur={() => {
            if (sessionLabel !== (take.session_label ?? "")) {
              patchTake.mutate({ id: take.id, session_label: sessionLabel });
            }
          }}
          placeholder={t("project.audio.session_label_placeholder")}
          className="h-6 w-44 text-xs"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <ProcessDialog
          takeId={take.id}
          projectId={projectId}
          trigger={
            <Button variant="outline" size="sm">
              <Sliders /> {t("project.audio.process_button")}
            </Button>
          }
        />
        <ExportDialog
          take={take}
          trigger={
            <Button variant="outline" size="sm">
              <Download /> {t("project.audio.export_button")}
            </Button>
          }
        />
        {mode === "voice_guitar" && (
          <StemsDialog
            takeId={take.id}
            projectId={projectId}
            trigger={
              <Button variant="outline" size="sm">
                <Split /> {t("project.stems.separate_button")}
              </Button>
            }
          />
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="ml-auto text-muted-foreground hover:text-alert">
              <Trash2 />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("project.audio.delete_take_confirm_title")}</AlertDialogTitle>
              <AlertDialogDescription>{t("project.audio.delete_take_confirm_description")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-alert text-alert-foreground hover:bg-alert/90"
                onClick={() => deleteTake.mutate(take.id)}
              >
                {t("common.delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
