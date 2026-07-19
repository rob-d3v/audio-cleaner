import { useState } from "react";
import { useTranslation } from "react-i18next";
import { History } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { useLyricsVersion, useLyricsVersions, useRestoreLyricsVersion } from "@/api/hooks/useLyrics";
import { formatDateTime } from "@/lib/labels";

export function LyricsVersionsPopover({
  projectId,
  onRestored,
}: {
  projectId: string;
  onRestored: (text: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [selectedTs, setSelectedTs] = useState<number | null>(null);
  const versionsQuery = useLyricsVersions(open ? projectId : undefined);
  const versionQuery = useLyricsVersion(projectId, selectedTs);
  const restore = useRestoreLyricsVersion(projectId);

  const versions = versionsQuery.data ?? [];

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSelectedTs(null);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <History /> {t("project.lyrics.versions")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        {selectedTs === null ? (
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {versions.length === 0 ? (
              <p className="p-2 text-xs text-muted-foreground">{t("project.lyrics.versions_empty")}</p>
            ) : (
              versions.map((version) => (
                <button
                  key={version.ts}
                  type="button"
                  onClick={() => setSelectedTs(version.ts)}
                  className="block w-full rounded-md p-2 text-left text-xs hover:bg-muted"
                >
                  <p className="font-numeric text-muted-foreground">
                    {formatDateTime(version.created_at, i18n.language)}
                  </p>
                  <p className="mt-0.5 truncate text-foreground">{version.preview || "—"}</p>
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedTs(null)}>
              {t("common.back")}
            </Button>
            <ScrollArea className="h-48 rounded-md border border-border p-2">
              <p className="text-xs whitespace-pre-wrap text-foreground">{versionQuery.data?.text}</p>
            </ScrollArea>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" className="w-full">
                  {t("project.lyrics.restore")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("project.lyrics.restore_confirm_title")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("project.lyrics.restore_confirm_description", {
                      date: formatDateTime(
                        versions.find((v) => v.ts === selectedTs)?.created_at,
                        i18n.language,
                      ),
                    })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      if (selectedTs === null) return;
                      restore.mutate(selectedTs, {
                        onSuccess: () => {
                          if (versionQuery.data?.text !== undefined) onRestored(versionQuery.data.text);
                          setOpen(false);
                          setSelectedTs(null);
                        },
                      });
                    }}
                  >
                    {t("common.confirm")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
