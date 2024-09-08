import { create } from 'zustand';
import { createTrackSlice, TrackSlice } from './TrackSlice';
import { createMasterSlice, MasterSlice } from './MasterSlice';
import { createHistorySlice, HistorySlice } from './HistorySlice';
import { createWorkerSlice, WorkerSlice } from './WorkerSlice';

const useMixerStore = create<
  MasterSlice & TrackSlice & HistorySlice & WorkerSlice
>()((...a) => ({
  ...createMasterSlice(...a),
  ...createTrackSlice(...a),
  ...createHistorySlice(...a),
  ...createWorkerSlice(...a),
}));

export default useMixerStore;
