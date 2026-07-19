import { useState } from "react";
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
import { useCreateAlbum } from "@/api/hooks/useAlbums";
import { ApiError } from "@/api/client";
import { tFallback } from "@/lib/labels";

export function NewAlbumDialog({ trigger }: { trigger: React.ReactNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const createAlbum = useCreateAlbum();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createAlbum.mutate(
      { name: name.trim() },
      {
        onSuccess: () => {
          setOpen(false);
          setName("");
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
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("library.album_dialog.title")}</DialogTitle>
            <DialogDescription>{t("library.album_dialog.description")}</DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-1.5">
            <Label htmlFor="new-album-name">{t("library.album_dialog.name_label")}</Label>
            <Input
              id="new-album-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("library.album_dialog.name_placeholder")}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!name.trim() || createAlbum.isPending}>
              {createAlbum.isPending ? t("common.saving") : t("library.album_dialog.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
