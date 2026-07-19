import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { useCreateMetaTag, useDeleteMetaTag, useMetaTags } from "@/api/hooks/useMetaTags";
import { ApiError } from "@/api/client";
import { tFallback } from "@/lib/labels";
import type { MetaTagTier } from "@/api/types";

const TIERS: MetaTagTier[] = [1, 2, 3, 4];

function NewMetaTagDialog() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [tag, setTag] = useState("");
  const [category, setCategory] = useState("");
  const [tier, setTier] = useState<MetaTagTier>(2);
  const [description, setDescription] = useState("");
  const createTag = useCreateMetaTag();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tag.trim()) return;
    createTag.mutate(
      {
        tag: tag.trim(),
        category: category.trim() || "custom",
        tier,
        description_key: description.trim() || tag.trim(),
      },
      {
        onSuccess: () => {
          setOpen(false);
          setTag("");
          setCategory("");
          setTier(2);
          setDescription("");
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
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> {t("templates.metatags.new_tag")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("templates.metatags.new_tag")}</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-3">
            <div className="space-y-1">
              <Label>{t("templates.metatags.tag_label")}</Label>
              <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder={t("templates.metatags.tag_placeholder")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t("templates.metatags.category_label")}</Label>
                <Input value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>{t("templates.metatags.tier_label")}</Label>
                <Select value={String(tier)} onValueChange={(v) => setTier(Number(v) as MetaTagTier)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIERS.map((tierValue) => (
                      <SelectItem key={tierValue} value={String(tierValue)}>
                        {t(`metatags.tier.${tierValue}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>{t("templates.metatags.description_label")}</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!tag.trim() || createTag.isPending}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MetaTagManager() {
  const { t } = useTranslation();
  const metaTagsQuery = useMetaTags();
  const deleteTag = useDeleteMetaTag();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-lg font-semibold text-foreground">{t("templates.metatags.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("templates.metatags.subtitle")}</p>
        </div>
        <NewMetaTagDialog />
      </div>

      <div className="flex flex-wrap gap-2 rounded-lg border border-border p-3">
        <span className="text-xs font-medium text-muted-foreground">{t("templates.metatags.tier_legend_title")}:</span>
        {TIERS.map((tier) => (
          <span key={tier} className="text-xs text-muted-foreground">
            {t(`templates.metatags.tier_legend.${tier}`)}
          </span>
        ))}
      </div>

      <div className="space-y-1.5">
        {(metaTagsQuery.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("templates.metatags.empty")}</p>
        ) : (
          (metaTagsQuery.data ?? []).map((tag) => (
            <div
              key={tag.id}
              className="flex items-center justify-between gap-3 rounded-lg bg-card px-3 py-2 ring-1 ring-foreground/10"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="font-numeric text-sm text-foreground">[{tag.tag}]</span>
                <Badge variant="outline" className="text-[10px]">
                  {tFallback(t, `metatags.category.${tag.category}`, tag.category)}
                </Badge>
                <Badge
                  variant="outline"
                  className={tag.tier === 4 ? "border-alert/30 text-[10px] text-alert" : "text-[10px]"}
                >
                  {t(`metatags.tier.${tag.tier}`)}
                </Badge>
                <span className="truncate text-xs text-muted-foreground">
                  {tFallback(t, tag.description_key, tag.tag)}
                </span>
              </div>
              {tag.builtin ? (
                <Badge variant="outline" className="text-[10px]">
                  {t("common.builtin")}
                </Badge>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-alert">
                      <Trash2 />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("templates.metatags.delete_confirm_title", { tag: tag.tag })}</AlertDialogTitle>
                      <AlertDialogDescription>{t("templates.delete_confirm_description")}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-alert text-alert-foreground hover:bg-alert/90"
                        onClick={() => deleteTag.mutate(tag.id)}
                      >
                        {t("common.delete")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
