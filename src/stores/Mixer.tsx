import { create } from 'zustand';
import { createTrackSlice, TrackSlice } from './TrackSlice';
import { createMasterSlice, MasterSlice } from './MasterSlice';
import { createHistorySlice, HistorySlice } from './HistorySlice';

const useMixerStore = create<MasterSlice & TrackSlice & HistorySlice>()(
  (...a) => ({
    ...createMasterSlice(...a),
    ...createTrackSlice(...a),
    ...createHistorySlice(...a),
  })
);

export default useMixerStore;
