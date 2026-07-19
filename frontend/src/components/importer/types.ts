import type { ImportScanItem, ProjectStatus } from "@/api/types";

export interface WizardItem {
  key: string;
  folder: string;
  name: string;
  status: ProjectStatus;
  includedAudio: string[];
  lyricsFile: string | null;
  coverFile: string | null;
  albumId: string | null;
  selected: boolean;
  scan: ImportScanItem;
}

export function wizardItemFromScan(item: ImportScanItem): WizardItem {
  return {
    key: item.folder,
    folder: item.folder,
    name: item.suggested_name || item.name_raw,
    status: item.suggested_status,
    includedAudio: item.audio.filter((a) => !a.needs_transcode).map((a) => a.file),
    lyricsFile: item.lyrics[0]?.file ?? null,
    coverFile: item.cover,
    albumId: null,
    selected: true,
    scan: item,
  };
}
