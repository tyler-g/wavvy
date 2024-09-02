import { StateCreator } from 'zustand';
import WaveSurfer, { WaveSurferEvents } from 'wavesurfer.js';

import { MasterSlice } from './MasterSlice';
import { HistorySlice } from './HistorySlice';

import { sendCmdToAllRemotePeers } from '../utils/peer-utils';

interface removeTrackMetadata {
  id: number;
}

type WaveSurferListeners = {
  [key in keyof WaveSurferEvents]: () => void;
};

interface Track {
  id: number;
  wavesurfer: WaveSurfer | null;
  source: MediaStream | null;
  wavesurferEventListeners: WaveSurferListeners;
}

export interface TrackSlice {
  tracks: Track[];
  setTrackWaveSurfer: (id: number, instance: WaveSurfer) => void;
  setTrackWaveSurferEventListener: (
    id: number,
    event: keyof WaveSurferEvents,
    listener: any
  ) => void;
  setTrackSource: (id: number, stream: MediaStream) => void;

  // these are actions that can be used locally or from a peer cmd
  addTrack: (fromPeer?: boolean) => void;
  removeTrack: (data: removeTrackMetadata, fromPeer?: boolean) => void;
}

export const createTrackSlice: StateCreator<
  TrackSlice & MasterSlice & HistorySlice,
  [],
  [],
  TrackSlice
> = (set, get) => ({
  tracks: [],
  setTrackWaveSurfer: (id, instance) => {
    const tracks = get().tracks;
    const trackIndexWithThisId = tracks.findIndex((track) => track.id === id);
    const newTracks = [...tracks];
    newTracks[trackIndexWithThisId].wavesurfer = instance;
    set(() => ({
      tracks: [...newTracks],
    }));
  },
  setTrackWaveSurferEventListener: (id, event, listener) => {
    const tracks = get().tracks;
    const trackIndexWithThisId = tracks.findIndex((track) => track.id === id);
    const newTracks = [...tracks];
    newTracks[trackIndexWithThisId].wavesurferEventListeners[event] = listener;
    set(() => ({
      tracks: [...newTracks],
    }));
  },
  setTrackSource: (id, stream) => {
    console.log('setTrackSource', id, stream);
    const masterState = get().master;

    const tracks = get().tracks;
    const trackIndexWithThisId = tracks.findIndex((track) => track.id === id);
    const newTracks = [...tracks];
    newTracks[trackIndexWithThisId].source = stream;

    const streamSource =
      masterState.audioContext?.createMediaStreamSource(stream);
    if (
      masterState.volumeWorkletNode &&
      masterState.audioContext?.destination
    ) {
      streamSource?.connect(masterState.volumeWorkletNode);
    }

    set(() => ({
      tracks: [...newTracks],
    }));
  },
  addTrack: (fromPeer = false) => {
    const tracks = get().tracks;
    const id = tracks.length + 1;
    set((state) => ({
      tracks: [
        ...state.tracks,
        {
          id,
          wavesurfer: null,
          source: null,
          wavesurferEventListeners: {} as WaveSurferListeners,
        },
      ],
    }));

    const { addActionToHistory } = get();
    addActionToHistory({
      cmd: 'addTrack',
    });
    if (!fromPeer) {
      sendCmdToAllRemotePeers('addTrack', null);
    }
  },
  removeTrack: (data, fromPeer = false) => {
    const { id } = data;
    console.log('removeTrack', id, fromPeer);
    set((state) => ({
      tracks: [...state.tracks].filter((track) => track.id !== id),
    }));
    if (!fromPeer) {
      sendCmdToAllRemotePeers('removeTrack', data);
    }
  },
});
