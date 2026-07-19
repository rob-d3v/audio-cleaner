import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { STATUS_ORDER } from "@/lib/status";
import type { Album } from "@/api/types";
import type { WizardItem } from "@/components/importer/types";

export function ReviewTable({
  items,
  onChange,
  albums,
}: {
  items: WizardItem[];
  onChange: (key: string, patch: Partial<WizardItem>) => void;
  albums: Album[];
}) {
  const { t } = useTranslation();

  const allSelected = items.length > 0 && items.every((i) => i.selected);
  const someSelected = items.some((i) => i.selected);

  const toggleAll = () => {
    const next = !allSelected;
    for (const item of items) onChange(item.key, { selected: next });
  };

  const toggleAudioFile = (item: WizardItem, file: string) => {
    const included = item.includedAudio.includes(file);
    onChange(item.key, {
      includedAudio: included ? item.includedAudio.filter((f) => f !== file) : [...item.includedAudio, file],
    });
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8">
            <Checkbox
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              onCheckedChange={toggleAll}
              aria-label={t("import.step2.select_all")}
            />
          </TableHead>
          <TableHead>{t("import.step2.table.folder")}</TableHead>
          <TableHead>{t("import.step2.table.name")}</TableHead>
          <TableHead>{t("import.step2.table.status")}</TableHead>
          <TableHead>{t("import.step2.table.audio")}</TableHead>
          <TableHead>{t("import.step2.table.lyrics")}</TableHead>
          <TableHead>{t("import.step2.table.cover")}</TableHead>
          <TableHead>{t("import.step2.table.album")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.key} className={!item.selected ? "opacity-50" : undefined}>
            <TableCell>
              <Checkbox
                checked={item.selected}
                onCheckedChange={(checked) => onChange(item.key, { selected: Boolean(checked) })}
              />
            </TableCell>
            <TableCell className="max-w-40 truncate text-xs text-muted-foreground" title={item.folder}>
              {item.folder}
              {item.scan.warnings.length > 0 && (
                <span
                  className="ml-1 inline-flex items-center align-middle text-caution"
                  title={item.scan.warnings.join("\n")}
                >
                  <AlertTriangle className="size-3" />
                </span>
              )}
            </TableCell>
            <TableCell className="min-w-40 whitespace-normal">
              <Input
                value={item.name}
                onChange={(e) => onChange(item.key, { name: e.target.value })}
                className="h-7 text-xs"
              />
            </TableCell>
            <TableCell>
              <Select value={item.status} onValueChange={(v) => onChange(item.key, { status: v as WizardItem["status"] })}>
                <SelectTrigger size="sm" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_ORDER.map((status) => (
                    <SelectItem key={status} value={status}>
                      {t(`status.${status}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell className="min-w-36 whitespace-normal">
              {item.scan.audio.length === 0 ? (
                <span className="text-xs text-muted-foreground">{t("import.step2.no_audio")}</span>
              ) : (
                <div className="space-y-1">
                  {item.scan.audio.map((audio) => (
                    <label key={audio.file} className="flex items-center gap-1.5 text-xs">
                      <Checkbox
                        checked={item.includedAudio.includes(audio.file)}
                        onCheckedChange={() => toggleAudioFile(item, audio.file)}
                        disabled={audio.needs_transcode}
                      />
                      <span className="truncate" title={audio.file}>
                        {audio.file}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </TableCell>
            <TableCell className="min-w-32 whitespace-normal">
              {item.scan.lyrics.length === 0 ? (
                <span className="text-xs text-muted-foreground">{t("import.step2.no_lyrics")}</span>
              ) : (
                <Select
                  value={item.lyricsFile ?? "__none__"}
                  onValueChange={(v) => onChange(item.key, { lyricsFile: v === "__none__" ? null : v })}
                >
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t("common.none")}</SelectItem>
                    {item.scan.lyrics.map((lyric) => (
                      <SelectItem key={lyric.file} value={lyric.file}>
                        {lyric.file}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {item.coverFile ? item.coverFile : t("import.step2.no_cover")}
            </TableCell>
            <TableCell className="min-w-32">
              <Select
                value={item.albumId ?? "__none__"}
                onValueChange={(v) => onChange(item.key, { albumId: v === "__none__" ? null : v })}
              >
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("common.none")}</SelectItem>
                  {albums.map((album) => (
                    <SelectItem key={album.id} value={album.id}>
                      {album.name || t("library.album.untitled")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
