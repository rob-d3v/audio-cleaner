import { useCallback, useEffect, useRef, useState } from "react";

import { SILENT_SAMPLE, type MeterSample } from "@/store/meterStore";

export type BrowserRecorderState = "idle" | "requesting" | "recording" | "stopping";

export interface BrowserRecordedBlob {
  blob: Blob;
  mimeType: string;
  durationS: number;
}

export interface UseBrowserRecorderResult {
  /** False when getUserMedia/MediaRecorder aren't usable here (insecure context, unsupported browser). */
  supported: boolean;
  state: BrowserRecorderState;
  elapsedS: number;
  /** An `errors.*` i18n key describing the last failure, or null. */
  errorKey: string | null;
  devices: MediaDeviceInfo[];
  deviceId: string | null;
  setDeviceId: (id: string | null) => void;
  /** Non-reactive sample getter for LevelMeter's rAF loop — never triggers re-renders. */
  getSample: () => MeterSample;
  start: () => Promise<void>;
  stop: () => Promise<BrowserRecordedBlob | null>;
}

// Preferred recording mimeTypes, in order. Opus/webm is the smallest and most
// broadly supported on desktop + Android Chrome; mp4/aac covers Safari/iOS.
const CANDIDATE_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/ogg",
];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return undefined;
  }
  return CANDIDATE_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

function isSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined"
  );
}

function classifyGetUserMediaError(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError" || err.name === "SecurityError") return "errors.mic_denied";
    if (err.name === "NotFoundError" || err.name === "OverconstrainedError") return "errors.no_mic";
  }
  return "errors.unknown";
}

/** Builds a non-reactive RMS/peak dBFS sampler over an AnalyserNode, with a
 * simple hold-then-decay peak marker so it reads like the server-side meter. */
function createLevelSampler(analyser: AnalyserNode): () => MeterSample {
  const buffer = new Float32Array(analyser.fftSize);
  let peakHoldDb = -90;
  let peakHoldAt = 0;
  const HOLD_MS = 1500;
  const DECAY_DB_PER_S = 20;
  const CLIP_THRESHOLD_DB = -0.5;

  return () => {
    analyser.getFloatTimeDomainData(buffer);
    let sumSquares = 0;
    let peakAbs = 0;
    for (let i = 0; i < buffer.length; i++) {
      const v = buffer[i];
      sumSquares += v * v;
      const abs = Math.abs(v);
      if (abs > peakAbs) peakAbs = abs;
    }
    const rms = Math.sqrt(sumSquares / buffer.length);
    const rmsDb = Math.max(rms > 0 ? 20 * Math.log10(rms) : -90, -90);
    const peakDb = Math.max(peakAbs > 0 ? 20 * Math.log10(peakAbs) : -90, -90);

    const now = performance.now();
    if (peakDb >= peakHoldDb) {
      peakHoldDb = peakDb;
      peakHoldAt = now;
    } else if (now - peakHoldAt > HOLD_MS) {
      const elapsedS = (now - peakHoldAt - HOLD_MS) / 1000;
      peakHoldDb = Math.max(peakDb, peakHoldDb - DECAY_DB_PER_S * elapsedS, -90);
    }

    return { t: now, rmsDb, peakDb, peakHoldDb, clip: peakDb >= CLIP_THRESHOLD_DB };
  };
}

/**
 * Captures raw microphone audio in the browser (getUserMedia + MediaRecorder)
 * for remote/mobile recording, where the server has no local mic to talk to.
 * Browser DSP (echo cancellation, noise suppression, AGC) is explicitly
 * disabled — we want the raw signal for the studio pipeline, not a
 * conferencing-cleaned one.
 */
export function useBrowserRecorder(): UseBrowserRecorderResult {
  const [state, setState] = useState<BrowserRecorderState>("idle");
  const [elapsedS, setElapsedS] = useState(0);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>("audio/webm");
  const samplerRef = useRef<(() => MeterSample) | null>(null);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | undefined>(undefined);

  const supported = isSupported();

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices(list.filter((d) => d.kind === "audioinput"));
    } catch {
      // best-effort — device list is a nice-to-have, not required to record
    }
  }, []);

  useEffect(() => {
    if (!supported) return;
    void refreshDevices();
    navigator.mediaDevices.addEventListener?.("devicechange", refreshDevices);
    return () => navigator.mediaDevices.removeEventListener?.("devicechange", refreshDevices);
  }, [supported, refreshDevices]);

  const teardown = useCallback(() => {
    if (timerRef.current !== undefined) {
      window.clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      void audioContextRef.current.close();
    }
    audioContextRef.current = null;
    samplerRef.current = null;
    recorderRef.current = null;
  }, []);

  useEffect(() => teardown, [teardown]);

  const start = useCallback(async () => {
    setErrorKey(null);
    if (!supported) {
      setErrorKey("errors.insecure_context");
      throw new Error("insecure_context");
    }
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        },
      });
      streamRef.current = stream;
      void refreshDevices();

      const AudioContextCtor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) throw new Error("no_audio_context");
      const audioContext = new AudioContextCtor();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0;
      source.connect(analyser);
      samplerRef.current = createLevelSampler(analyser);

      const mimeType = pickMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mimeTypeRef.current = recorder.mimeType || mimeType || "audio/webm";
      chunksRef.current = [];
      recorder.addEventListener("dataavailable", (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      });
      recorder.start(250);
      recorderRef.current = recorder;

      startedAtRef.current = performance.now();
      setElapsedS(0);
      timerRef.current = window.setInterval(() => {
        setElapsedS((performance.now() - startedAtRef.current) / 1000);
      }, 200);

      setState("recording");
    } catch (err) {
      teardown();
      setState("idle");
      const key = classifyGetUserMediaError(err);
      setErrorKey(key);
      throw err;
    }
  }, [supported, deviceId, refreshDevices, teardown]);

  const stop = useCallback(async (): Promise<BrowserRecordedBlob | null> => {
    const recorder = recorderRef.current;
    if (!recorder || state !== "recording") return null;
    setState("stopping");
    const durationS = (performance.now() - startedAtRef.current) / 1000;
    const mimeType = mimeTypeRef.current;
    const blob = await new Promise<Blob>((resolve) => {
      recorder.addEventListener(
        "stop",
        () => resolve(new Blob(chunksRef.current, { type: mimeType })),
        { once: true },
      );
      recorder.stop();
    });
    teardown();
    setState("idle");
    setElapsedS(0);
    return { blob, mimeType, durationS };
  }, [state, teardown]);

  const getSample = useCallback((): MeterSample => {
    return samplerRef.current ? samplerRef.current() : SILENT_SAMPLE;
  }, []);

  return { supported, state, elapsedS, errorKey, devices, deviceId, setDeviceId, getSample, start, stop };
}
