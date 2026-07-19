import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Textarea } from "@/components/ui/textarea";
import { MetaTagPalette } from "@/components/project/MetaTagPalette";
import { LyricsVersionsPopover } from "@/components/project/LyricsVersionsPopover";
import { useLyrics, usePutLyrics } from "@/api/hooks/useLyrics";
import { formatTime } from "@/lib/labels";

const AUTOSAVE_DELAY_MS = 1500;

function insertAtCursor(
  el: HTMLTextAreaElement,
  insertText: string,
  current: string,
): { text: string; cursor: number } {
  const start = el.selectionStart ?? current.length;
  const end = el.selectionEnd ?? current.length;
  const next = current.slice(0, start) + insertText + current.slice(end);
  return { text: next, cursor: start + insertText.length };
}

export function LyricsTab({ projectId }: { projectId: string }) {
  const { t, i18n } = useTranslation();
  const lyricsQuery = useLyrics(projectId);
  const putLyrics = usePutLyrics(projectId);
  const [text, setText] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const initialized = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (lyricsQuery.data && !initialized.current) {
      setText(lyricsQuery.data.text);
      initialized.current = true;
    }
  }, [lyricsQuery.data]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const scheduleSave = (value: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      putLyrics.mutate(
        { text: value, snapshot: false },
        { onSuccess: (res) => setSavedAt(res.updated_at) },
      );
    }, AUTOSAVE_DELAY_MS);
  };

  const handleChange = (value: string) => {
    setText(value);
    scheduleSave(value);
  };

  const handleInsert = (tagText: string) => {
    const el = textareaRef.current;
    if (!el) {
      handleChange(`${text}${tagText}`);
      return;
    }
    const { text: next, cursor } = insertAtCursor(el, tagText, text);
    handleChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  };

  const handleRestored = (restoredText: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setText(restoredText);
    setSavedAt(new Date().toISOString());
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {putLyrics.isPending
              ? t("project.lyrics.saving")
              : savedAt
                ? t("project.lyrics.saved_at", { time: formatTime(savedAt, i18n.language) })
                : " "}
          </p>
          <LyricsVersionsPopover projectId={projectId} onRestored={handleRestored} />
        </div>
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={t("project.lyrics.placeholder")}
          className="min-h-[55vh] resize-none font-normal leading-relaxed"
        />
      </div>
      <aside className="lg:border-l lg:border-border lg:pl-6">
        <MetaTagPalette onInsert={handleInsert} />
      </aside>
    </div>
  );
}
