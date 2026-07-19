import { useTranslation } from "react-i18next";
import { AudioWaveform, ListMusic, Mic2, Ruler, Sparkles } from "lucide-react";

const SECTIONS = [
  { key: "prep", icon: Sparkles },
  { key: "levels", icon: AudioWaveform },
  { key: "distance", icon: Ruler },
] as const;

const SCRIPT_STEPS = ["warmup", "vowels", "scales", "excerpt", "dynamics", "spoken_phrase"] as const;

export default function GuidePage() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6 lg:p-8">
      <header className="space-y-2">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">{t("guide.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("guide.subtitle")}</p>
        <p className="rounded-lg border border-border bg-card p-3 text-sm leading-relaxed text-foreground">
          {t("guide.intro")}
        </p>
      </header>

      <div className="space-y-4">
        {SECTIONS.map(({ key, icon: Icon }) => (
          <section key={key} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <h2 className="flex items-center gap-2 font-heading text-sm font-semibold text-foreground">
              <Icon className="size-4 text-primary" />
              {t(`guide.sections.${key}.title`)}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(`guide.sections.${key}.body`)}</p>
          </section>
        ))}
      </div>

      <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="flex items-center gap-2 font-heading text-sm font-semibold text-foreground">
          <ListMusic className="size-4 text-primary" />
          {t("guide.sections.script.title")}
        </h2>
        <ol className="mt-3 space-y-2">
          {SCRIPT_STEPS.map((step) => (
            <li key={step} className="flex items-start gap-2 text-sm text-foreground">
              <span className="mt-0.5 font-numeric text-xs text-muted-foreground">
                {SCRIPT_STEPS.indexOf(step) + 1}.
              </span>
              <span className="leading-relaxed">{t(`guide.sections.script.${step}`)}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-xl border border-primary/25 bg-primary/[0.04] p-4">
        <h2 className="flex items-center gap-2 font-heading text-sm font-semibold text-foreground">
          <Mic2 className="size-4 text-primary" />
          {t("guide.sections.expectations.title")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("guide.sections.expectations.body")}</p>
      </section>
    </div>
  );
}
