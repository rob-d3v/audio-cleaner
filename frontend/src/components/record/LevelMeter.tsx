import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useMeterStore, type MeterSample } from "@/store/meterStore";
import { cn } from "@/lib/utils";

// Fixed hardware-panel palette — a level meter reads the same whether the
// app chrome is in light or dark mode, like a real VU meter's dark face.
const COLOR_TRACK = "rgba(255,255,255,0.07)";
const COLOR_SIGNAL = "#2ecf82";
const COLOR_CAUTION = "#e8a33d";
const COLOR_ALERT = "#f0473f";

const MIN_DB = -60;
const MAX_DB = 3;
const ZONE_SAFE_END = -12;
const ZONE_CAUTION_END = -6;
const TICKS = [-60, -40, -20, -12, -6, 0];
const CLIP_LATCH_MS = 1400;

function dbToFraction(db: number): number {
  const clamped = Math.min(MAX_DB, Math.max(MIN_DB, db));
  return (clamped - MIN_DB) / (MAX_DB - MIN_DB);
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, radius);
  } else {
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
  }
  ctx.closePath();
}

/**
 * Console-style RMS/peak level meter. Reads samples via `getSample` (defaults
 * to the WS-fed meter store used by the native/server recorder) inside a
 * requestAnimationFrame loop — never through reactive state — so the browser
 * recorder can drive the exact same widget from its local AnalyserNode.
 */
export function LevelMeter({
  className,
  getSample,
}: {
  className?: string;
  getSample?: () => MeterSample;
}) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clipLedRef = useRef<HTMLDivElement>(null);
  const rmsReadoutRef = useRef<HTMLSpanElement>(null);
  const peakReadoutRef = useRef<HTMLSpanElement>(null);
  const getSampleRef = useRef(getSample);
  getSampleRef.current = getSample;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width * dpr));
      height = Math.max(1, Math.round(rect.height * dpr));
      canvas.width = width;
      canvas.height = height;
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    let raf = 0;
    let displayedRms = MIN_DB;
    let displayedPeak = MIN_DB;
    let lastClipAt = 0;
    let lastReadoutUpdate = 0;

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const sample = getSampleRef.current ? getSampleRef.current() : useMeterStore.getState().sample;

      // Simple attack/release ballistics: rise fast, fall slower — reads
      // like an analog meter instead of a jittery digital one.
      const attack = 0.55;
      const release = 0.12;
      const rmsTarget = sample.rmsDb;
      displayedRms += (rmsTarget - displayedRms) * (rmsTarget > displayedRms ? attack : release);
      const peakTarget = sample.peakDb;
      displayedPeak += (peakTarget - displayedPeak) * (peakTarget > displayedPeak ? 0.85 : 0.06);

      if (sample.clip) lastClipAt = now;

      ctx.clearRect(0, 0, width, height);

      const barH = height;
      roundRectPath(ctx, 0, 0, width, barH, barH / 2);
      ctx.fillStyle = COLOR_TRACK;
      ctx.fill();

      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      const safeEnd = dbToFraction(ZONE_SAFE_END);
      const cautionEnd = dbToFraction(ZONE_CAUTION_END);
      gradient.addColorStop(0, COLOR_SIGNAL);
      gradient.addColorStop(Math.max(0.001, safeEnd), COLOR_SIGNAL);
      gradient.addColorStop(Math.min(0.999, safeEnd + 0.001), COLOR_CAUTION);
      gradient.addColorStop(Math.max(safeEnd + 0.002, cautionEnd), COLOR_CAUTION);
      gradient.addColorStop(Math.min(0.999, cautionEnd + 0.001), COLOR_ALERT);
      gradient.addColorStop(1, COLOR_ALERT);

      const fillW = width * dbToFraction(displayedRms);
      if (fillW > 0) {
        ctx.save();
        roundRectPath(ctx, 0, 0, width, barH, barH / 2);
        ctx.clip();
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, fillW, barH);
        ctx.restore();
      }

      // Peak marker
      const peakX = width * dbToFraction(displayedPeak);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillRect(Math.max(0, peakX - 1 * dpr), 0, 1.5 * dpr, barH);

      // Peak-hold marker (server-provided, no client decay)
      const holdX = width * dbToFraction(sample.peakHoldDb);
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fillRect(Math.max(0, holdX - 0.5 * dpr), 0, 1 * dpr, barH);

      // Zone divider hairlines
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(width * safeEnd, 0, Math.max(1, 1 * dpr), barH);
      ctx.fillRect(width * cautionEnd, 0, Math.max(1, 1 * dpr), barH);

      const clipActive = now - lastClipAt < CLIP_LATCH_MS;
      if (clipLedRef.current) {
        clipLedRef.current.style.opacity = clipActive ? "1" : "0.16";
        clipLedRef.current.style.animation = clipActive ? "meter-clip-flash 0.5s ease-in-out infinite" : "none";
      }

      if (now - lastReadoutUpdate > 80) {
        lastReadoutUpdate = now;
        if (rmsReadoutRef.current) {
          rmsReadoutRef.current.textContent = Number.isFinite(sample.rmsDb) && sample.rmsDb > -90
            ? sample.rmsDb.toFixed(1)
            : "-∞";
        }
        if (peakReadoutRef.current) {
          peakReadoutRef.current.textContent = Number.isFinite(sample.peakDb) && sample.peakDb > -90
            ? sample.peakDb.toFixed(1)
            : "-∞";
        }
      }
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div className={cn("rounded-xl bg-[#0a0a0b] p-4 ring-1 ring-white/10", className)}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-baseline gap-3 font-numeric text-xs text-white/50">
          <span>
            {t("record.meter.rms")}{" "}
            <span ref={rmsReadoutRef} className="text-sm text-white/85">
              -∞
            </span>
          </span>
          <span>
            {t("record.meter.peak")}{" "}
            <span ref={peakReadoutRef} className="text-sm text-white/85">
              -∞
            </span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            ref={clipLedRef}
            className="size-2 rounded-full bg-[#f0473f] opacity-15 transition-opacity"
            style={{ boxShadow: "0 0 6px 1px rgba(240,71,63,0.7)" }}
          />
          <span className="text-[10px] font-medium tracking-wide text-white/40 uppercase">
            {t("record.meter.clip")}
          </span>
        </div>
      </div>
      <canvas ref={canvasRef} className="h-6 w-full" />
      <div className="mt-1.5 flex justify-between font-numeric text-[10px] text-white/35">
        {TICKS.map((db) => (
          <span key={db}>{db}</span>
        ))}
      </div>
    </div>
  );
}
