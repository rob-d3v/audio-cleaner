import { create } from "zustand";

// Level-meter data changes ~20-60x/second. Routing that through React state
// would mean 20-60 re-renders/sec on anything subscribed. Instead this store
// is written to from the WS handler and read with `getState()` inside a
// requestAnimationFrame loop (see LevelMeter) — never via the reactive
// `useMeterStore()` hook — so no component re-renders per sample.

export interface MeterSample {
  t: number;
  rmsDb: number;
  peakDb: number;
  peakHoldDb: number;
  clip: boolean;
}

export const SILENT_SAMPLE: MeterSample = {
  t: 0,
  rmsDb: -90,
  peakDb: -90,
  peakHoldDb: -90,
  clip: false,
};

interface MeterStoreState {
  sample: MeterSample;
  setSample: (sample: MeterSample) => void;
  reset: () => void;
}

export const useMeterStore = create<MeterStoreState>((set) => ({
  sample: SILENT_SAMPLE,
  setSample: (sample) => set({ sample }),
  reset: () => set({ sample: SILENT_SAMPLE }),
}));
