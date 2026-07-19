import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { WaveformPlayer, type WaveformPlayerHandle } from "@/components/player/WaveformPlayer";
import { takeAudioUrl } from "@/api/hooks/useTakes";

/**
 * Two audio variants, one transport: switching A/B swaps the wavesurfer
 * source in place and restores the playback position (as a fraction of
 * duration) once the new source is ready, instead of resetting to 0.
 */
export function ABPlayer({
  takeId,
  processedChainHash,
  compact,
}: {
  takeId: string;
  processedChainHash: string | null;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const [variant, setVariant] = useState<"raw" | "processed">(processedChainHash ? "processed" : "raw");
  const playerRef = useRef<WaveformPlayerHandle>(null);
  const pendingFractionRef = useRef<number | null>(null);

  const src =
    variant === "processed" && processedChainHash
      ? takeAudioUrl(takeId, processedChainHash)
      : takeAudioUrl(takeId, "raw");

  const handleToggle = (next: string) => {
    if (!next || next === variant) return;
    pendingFractionRef.current = playerRef.current?.getFraction() ?? null;
    setVariant(next as "raw" | "processed");
  };

  const handleReady = () => {
    if (pendingFractionRef.current !== null) {
      playerRef.current?.seekToFraction(pendingFractionRef.current);
      pendingFractionRef.current = null;
    }
  };

  return (
    <div className="space-y-2">
      <ToggleGroup type="single" value={variant} onValueChange={handleToggle} variant="outline" size="sm">
        <ToggleGroupItem value="raw">{t("project.audio.ab.raw")}</ToggleGroupItem>
        <ToggleGroupItem value="processed" disabled={!processedChainHash}>
          {t("project.audio.ab.processed")}
        </ToggleGroupItem>
      </ToggleGroup>
      <WaveformPlayer ref={playerRef} src={src} compact={compact} onReady={handleReady} />
    </div>
  );
}
