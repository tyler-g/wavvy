import { StateCreator } from 'zustand';

export interface MixerAction {
  cmd: string;
  data?: unknown;
}

export interface HistorySlice {
  history: MixerAction[];
  addActionToHistory: (action: MixerAction) => void;
}

export const createHistorySlice: StateCreator<
  HistorySlice,
  [],
  [],
  HistorySlice
> = (set, get) => ({
  history: [],
  addActionToHistory: (action) => {
    set((state) => ({
      history: [...state.history, action],
    }));
  },
});
