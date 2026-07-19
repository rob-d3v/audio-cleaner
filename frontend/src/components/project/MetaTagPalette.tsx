import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { tFallback } from "@/lib/labels";
import { useMetaTags } from "@/api/hooks/useMetaTags";
import type { MetaTag } from "@/api/types";

export function MetaTagPalette({ onInsert }: { onInsert: (tagText: string) => void }) {
  const { t } = useTranslation();
  const metaTagsQuery = useMetaTags();

  const grouped = useMemo(() => {
    const byCategory = new Map<string, MetaTag[]>();
    for (const tag of metaTagsQuery.data ?? []) {
      const list = byCategory.get(tag.category) ?? [];
      list.push(tag);
      byCategory.set(tag.category, list);
    }
    return Array.from(byCategory.entries());
  }, [metaTagsQuery.data]);

  return (
    <div className="space-y-2">
      <p className="font-heading text-sm font-semibold text-foreground">{t("project.lyrics.metatags_title")}</p>
      <p className="text-xs text-muted-foreground">{t("project.lyrics.metatags_hint")}</p>
      {grouped.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("project.lyrics.metatags_empty")}</p>
      ) : (
        <Accordion type="multiple" defaultValue={grouped.map(([category]) => category)} className="w-full">
          {grouped.map(([category, tags]) => (
            <AccordionItem key={category} value={category}>
              <AccordionTrigger className="text-xs font-medium tracking-wide text-muted-foreground uppercase hover:no-underline">
                {tFallback(t, `metatags.category.${category}`, category)}
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => onInsert(`[${tag.tag}]`)}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                    >
                      {tFallback(t, tag.description_key, tag.tag)}
                      {tag.tier === 4 && (
                        <Badge variant="outline" className="h-4 border-alert/30 px-1 text-[9px] text-alert">
                          {t("metatags.tier.4")}
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
