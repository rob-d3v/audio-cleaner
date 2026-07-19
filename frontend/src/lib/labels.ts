import type { TFunction } from "i18next";

/** "guitar_solo" / "guitar-solo" -> "Guitar solo" */
export function humanize(id: string): string {
  const words = id.replace(/[_-]+/g, " ").trim();
  if (!words) return id;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Translates a backend-supplied key (stage.name_key, meta-tag category,
 * preset name_key, error message_key…) and falls back to a humanized
 * version of the id instead of ever rendering a raw dotted key.
 *
 * Keys without a "." are treated as literal, user-authored text (e.g. a
 * custom template's free-typed variable label) rather than a translation
 * key, and are returned as-is.
 */
export function tFallback(t: TFunction, key: string | undefined | null, fallbackId?: string): string {
  if (!key) return fallbackId ? humanize(fallbackId) : "";
  if (!key.includes(".")) return key;
  const fallback = fallbackId ? humanize(fallbackId) : humanize(key.split(".").pop() ?? key);
  return t(key, { defaultValue: fallback });
}

export function formatDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}

export function formatDateTime(iso: string | null | undefined, locale: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function formatTime(iso: string | null | undefined, locale: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(date);
}

/** Seconds -> "1:23" / "12:04" */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

export function formatDb(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-∞";
  if (value <= -90) return "-∞";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}
