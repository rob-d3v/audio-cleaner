import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { LANGUAGES, RTL_LANGS } from "./languages";

export const defaultNS = "common";
export const LANG_STORAGE_KEY = "ac-lang";

/** Every locale code shipped with the app (from the registry). */
export const SUPPORTED_LANGS: readonly string[] = LANGUAGES.map((l) => l.code);
export type SupportedLang = string;
export const DEFAULT_LANG = "pt-BR";

/**
 * Base locales are bundled EAGERLY — they are always available with no network
 * round-trip and are the fallback targets. Every other locale is code-split and
 * dynamically imported only when the user selects it. This is the deliberate fix
 * for the ~190-JSON rollup OOM: the main bundle carries just en + pt-BR, and the
 * lazy glob excludes them so vite never double-imports (statically + dynamically).
 */
type LocaleData = Record<string, unknown>;

const eagerBases = import.meta.glob("./locales/{en,pt-BR}.json", {
  eager: true,
  import: "default",
}) as Record<string, LocaleData>;

const lazyLocales = import.meta.glob(
  ["./locales/*.json", "!./locales/en.json", "!./locales/pt-BR.json"],
  { import: "default" },
) as Record<string, () => Promise<LocaleData>>;

function codeFromPath(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1).replace(/\.json$/, "");
}

const resources: Record<string, { common: LocaleData }> = {};
for (const [path, data] of Object.entries(eagerBases)) {
  resources[codeFromPath(path)] = { common: data };
}

const loadedLangs = new Set(Object.keys(resources));
const lazyByCode = new Map(
  Object.entries(lazyLocales).map(([path, loader]) => [codeFromPath(path), loader]),
);

function applyDocumentLang(lng: string): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lng;
  document.documentElement.dir = RTL_LANGS.has(lng) ? "rtl" : "ltr";
}

/** Dynamically import + register a non-base locale bundle the first time it is used. */
export async function ensureLangLoaded(lng: string): Promise<void> {
  if (loadedLangs.has(lng)) return;
  const loader = lazyByCode.get(lng);
  if (!loader) return; // unknown code — fallbackLng ('en') covers it
  try {
    const data = await loader();
    i18n.addResourceBundle(lng, defaultNS, data, true, true);
    loadedLangs.add(lng);
  } catch (err) {
    if (import.meta.env.DEV) console.error(`[i18n] failed to load locale "${lng}"`, err);
  }
}

/** Load (if needed) then switch — the single entry point the UI should call. */
export async function changeAppLanguage(lng: string): Promise<void> {
  await ensureLangLoaded(lng);
  await i18n.changeLanguage(lng);
}

function getStoredLang(): string {
  if (typeof window === "undefined") return DEFAULT_LANG;
  const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
  return stored && SUPPORTED_LANGS.includes(stored) ? stored : DEFAULT_LANG;
}

const initialLang = getStoredLang();

function humanizeKey(key: string): string {
  const leaf = key.split(".").pop() ?? key;
  const words = leaf.replace(/[_-]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : key;
}

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLang,
  fallbackLng: "en",
  supportedLngs: SUPPORTED_LANGS as string[],
  nonExplicitSupportedLngs: true,
  defaultNS,
  interpolation: {
    escapeValue: false,
  },
  // Belt-and-suspenders: a key missing from every loaded locale degrades to a
  // humanized label, never a raw dotted key on screen (loud in dev).
  parseMissingKeyHandler: (key) => {
    if (import.meta.env.DEV) console.error(`[i18n] missing key: ${key}`);
    return humanizeKey(key);
  },
});

applyDocumentLang(initialLang);

// If the persisted language is a lazy (non-base) locale, pull its bundle in now
// and re-apply so the first paint settles on it instead of the en fallback.
if (!loadedLangs.has(initialLang)) {
  void ensureLangLoaded(initialLang).then(() => {
    void i18n.changeLanguage(initialLang);
  });
}

i18n.on("languageChanged", (lng) => {
  applyDocumentLang(lng);
  if (typeof window !== "undefined" && SUPPORTED_LANGS.includes(lng)) {
    window.localStorage.setItem(LANG_STORAGE_KEY, lng);
  }
});

export default i18n;
