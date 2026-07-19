import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin, { type Region } from "wavesurfer.js/plugins/regions";
import { Pause, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/labels";
import { cn } from "@/lib/utils";

export interface WaveformPlayerHandle {
  wavesurfer: WaveSurfer | null;
  playPause: () => void;
  getFraction: () => number;
  seekToFraction: (fraction: number) => void;
}

export interface WaveformRegion {
  start: number;
  end: number;
}

interface WaveformPlayerProps {
  src: string;
  compact?: boolean;
  className?: string;
  onReady?: () => void;
  /**
   * Optional highlighted region (e.g. the best-2-min export window).
   * Draggable/resizable only when `onRegionChange` is supplied.
   */
  region?: WaveformRegion | null;
  onRegionChange?: (region: WaveformRegion) => void;
  regionColor?: string;
}

export const WaveformPlayer = forwardRef<WaveformPlayerHandle, WaveformPlayerProps>(function WaveformPlayer(
  { src, compact = false, className, onReady, region, onRegionChange, regionColor },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<RegionsPlugin | null>(null);
  const activeRegionRef = useRef<Region | null>(null);
  const defaultRegionColorRef = useRef("rgba(46,207,130,0.22)");
  const onRegionChangeRef = useRef(onRegionChange);
  onRegionChangeRef.current = onRegionChange;
  const isFirstSrcEffect = useRef(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const styles = getComputedStyle(document.documentElement);
    const waveColor = styles.getPropertyValue("--muted-foreground").trim() || "#888";
    const progressColor = styles.getPropertyValue("--primary").trim() || "#2ecf82";
    const cursorColor = styles.getPropertyValue("--foreground").trim() || "#fff";
    const primaryRaw = styles.getPropertyValue("--primary").trim();
    if (primaryRaw) {
      defaultRegionColorRef.current = `${primaryRaw.replace(/\)\s*$/, "")} / 22%)`;
    }

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor,
      progressColor,
      cursorColor,
      cursorWidth: 1,
      height: compact ? 36 : 60,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
      url: src,
    });
    wsRef.current = ws;

    const regionsPlugin = ws.registerPlugin(RegionsPlugin.create());
    regionsRef.current = regionsPlugin;
    regionsPlugin.on("region-updated", (r) => {
      onRegionChangeRef.current?.({ start: r.start, end: r.end });
    });

    const handleReady = () => {
      setIsReady(true);
      setDuration(ws.getDuration());
      onReady?.();
    };
    ws.on("ready", handleReady);
    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));
    ws.on("finish", () => setIsPlaying(false));
    ws.on("timeupdate", (time) => setCurrentTime(time));

    return () => {
      ws.destroy();
      wsRef.current = null;
      regionsRef.current = null;
      activeRegionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isFirstSrcEffect.current) {
      isFirstSrcEffect.current = false;
      return;
    }
    const ws = wsRef.current;
    if (!ws) return;
    setIsReady(false);
    setCurrentTime(0);
    void ws.load(src);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // (re)draws the highlighted region whenever it changes, or once the
  // waveform (re)loads — regions live on the wavesurfer instance and are
  // cleared on every `load()`.
  useEffect(() => {
    const regionsPlugin = regionsRef.current;
    if (!regionsPlugin || !isReady) return;
    regionsPlugin.clearRegions();
    activeRegionRef.current = region
      ? regionsPlugin.addRegion({
          start: region.start,
          end: region.end,
          color: regionColor ?? defaultRegionColorRef.current,
          drag: Boolean(onRegionChange),
          resize: Boolean(onRegionChange),
        })
      : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, isReady, regionColor]);

  useImperativeHandle(ref, () => ({
    wavesurfer: wsRef.current,
    playPause: () => wsRef.current?.playPause(),
    getFraction: () => {
      const ws = wsRef.current;
      if (!ws || !ws.getDuration()) return 0;
      return ws.getCurrentTime() / ws.getDuration();
    },
    seekToFraction: (fraction: number) => {
      wsRef.current?.seekTo(Math.min(1, Math.max(0, fraction)));
    },
  }));

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Button
        type="button"
        size="icon-sm"
        variant="secondary"
        onClick={() => wsRef.current?.playPause()}
        disabled={!isReady}
      >
        {isPlaying ? <Pause /> : <Play />}
      </Button>
      <div ref={containerRef} className="min-w-0 flex-1" />
      <span className="font-numeric shrink-0 text-xs text-muted-foreground">
        {formatDuration(currentTime)} / {formatDuration(duration)}
      </span>
    </div>
  );
});
