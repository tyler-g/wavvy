import { StateCreator } from 'zustand';

interface WorkerState {
  encoder: Worker;
  decoder: Worker;
  exporter: Worker;
}

export interface WorkerSlice {
  workers: WorkerState;
  setWorkerEncoder: (worker: Worker) => void;
  setWorkerDecoder: (worker: Worker) => void;
  setWorkerExporter: (worker: Worker) => void;
}

export const createWorkerSlice: StateCreator<
  WorkerSlice,
  [],
  [],
  WorkerSlice
> = (set, get) => ({
  workers: {
    encoder: null,
    decoder: null,
    exporter: null,
  },
  setWorkerEncoder: (worker) => {
    set((state) => ({
      workers: { ...state.workers, encoder: worker },
    }));
    console.log('setWorkerEncoder', worker);
  },
  setWorkerDecoder: (worker) => {
    set((state) => ({
      workers: { ...state.workers, decoder: worker },
    }));
    console.log('setWorkerDecoder', worker);
  },
  setWorkerExporter: (worker) => {
    set((state) => ({
      workers: { ...state.workers, exporter: worker },
    }));
    console.log('setWorkerExporter', worker);
  },
});
