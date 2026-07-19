import { create } from "zustand";

export type RecordPhase = "idle" | "monitoring" | "recording" | "stopped";

interface RecordStoreState {
  phase: RecordPhase;
  takeId: string | null;
  elapsedS: number;
  wsConnected: boolean;
  setRecordState: (partial: { state: RecordPhase; take_id: string | null; elapsed_s: number }) => void;
  setWsConnected: (connected: boolean) => void;
  reset: () => void;
}

export const useRecordStore = create<RecordStoreState>((set) => ({
  phase: "idle",
  takeId: null,
  elapsedS: 0,
  wsConnected: false,
  setRecordState: ({ state, take_id, elapsed_s }) =>
    set({ phase: state, takeId: take_id, elapsedS: elapsed_s }),
  setWsConnected: (connected) => set({ wsConnected: connected }),
  reset: () => set({ phase: "idle", takeId: null, elapsedS: 0 }),
}));
