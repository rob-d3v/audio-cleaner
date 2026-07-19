import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Textarea } from "@/components/ui/textarea";
import { useNotes, usePutNotes } from "@/api/hooks/useNotes";
import { formatTime } from "@/lib/labels";

const AUTOSAVE_DELAY_MS = 1500;

export function NotesTab({ projectId }: { projectId: string }) {
  const { t, i18n } = useTranslation();
  const notesQuery = useNotes(projectId);
  const putNotes = usePutNotes(projectId);
  const [text, setText] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const initialized = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (notesQuery.data && !initialized.current) {
      setText(notesQuery.data.text);
      initialized.current = true;
    }
  }, [notesQuery.data]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const handleChange = (value: string) => {
    setText(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      putNotes.mutate(value, { onSuccess: () => setSavedAt(new Date().toISOString()) });
    }, AUTOSAVE_DELAY_MS);
  };

  return (
    <div className="space-y-2">
      <Textarea
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={t("project.notes.placeholder")}
        className="min-h-[45vh] resize-none leading-relaxed"
      />
      <p className="text-right text-xs text-muted-foreground">
        {putNotes.isPending
          ? t("common.saving")
          : savedAt
            ? t("project.notes.saved_at", { time: formatTime(savedAt, i18n.language) })
            : " "}
      </p>
    </div>
  );
}
