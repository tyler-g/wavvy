import { create } from 'zustand';
import WaveSurfer from 'wavesurfer.js';
import { sendCmdToAllRemotePeers } from '../utils/peer-utils';

interface MasterState {
  db: number;
  audioContext: AudioContext | null;
  volumeWorkletNode: AudioWorkletNode | null;
  analyserNode: AnalyserNode | null;
}

export interface TrackState {
  id: number;
  wavesurfer: WaveSurfer | null;
  source: MediaStream | null;
}

interface removeTrackMetadata {
  id: number;
}

export interface MixerState {
  history: MixerAction[];
  master: MasterState;
  addActionToHistory: (action: MixerAction) => void;
  setupMasterAudioContext: () => void;
  setMasterVolumeWorkletNode: (node: AudioWorkletNode) => void;
  tracks: TrackState[];
  setDb: (val: number) => void;
  setTrackWaveSurfer: (id: number, instance: WaveSurfer) => void;
  setTrackSource: (id: number, stream: MediaStream) => void;

  // these are actions that can be used locally or from a peer cmd
  addTrack: (fromPeer?: boolean) => void;
  removeTrack: (data: removeTrackMetadata, fromPeer?: boolean) => void;
}

export interface MixerAction {
  cmd: string;
  data?: unknown;
}

const useMixerStore = create<MixerState>((set) => ({
  history: [],
  master: {
    db: 0,
    audioContext: null,
    volumeWorkletNode: null,
    analyserNode: null,
  },
  tracks: [] as TrackState[],
  addActionToHistory: (action) => {
    set((state) => ({
      history: [...state.history, action],
    }));
  },
  setMasterVolumeWorkletNode: (node) => {
    set((state) => ({
      master: { ...state.master, volumeWorkletNode: node },
    }));
    console.log('setMasterVolumeWorkletNode', node);
  },
  setupMasterAudioContext: async () => {
    const { setDb, setMasterVolumeWorkletNode } = useMixerStore.getState();

    // set up master audio context and analyser
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 4096;
    analyser.connect(context.destination);

    set((state) => ({
      master: {
        ...state.master,
        audioContext: context,
        analyserNode: analyser,
      },
    }));
    context.audioWorklet
      .addModule('src/worklets/volume-meter-processor.js')
      .then(async () => {
        const volumeMeterNode = new AudioWorkletNode(context, 'volume-meter');
        volumeMeterNode.port.onmessage = ({ data }) => {
          setDb(data);
        };
        setMasterVolumeWorkletNode(volumeMeterNode);
        volumeMeterNode.connect(analyser);
      })
      .catch((err) => {
        console.error('could not add volume meter processor', err);
      });
  },
  setDb: (val) =>
    set((state) => ({
      master: {
        ...state.master,
        db: val,
      },
    })),
  setTrackWaveSurfer: (id, instance) => {
    const tracks = useMixerStore.getState().tracks;
    const trackIndexWithThisId = tracks.findIndex((track) => track.id === id);
    const newTracks = [...tracks];
    newTracks[trackIndexWithThisId].wavesurfer = instance;
    set(() => ({
      tracks: [...newTracks],
    }));
  },
  setTrackSource: (id, stream) => {
    console.log('setTrackSource', id, stream);
    const masterState = useMixerStore.getState().master;

    const tracks = useMixerStore.getState().tracks;
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
    const tracks = useMixerStore.getState().tracks;
    const id = tracks.length + 1;
    set((state) => ({
      tracks: [...state.tracks, { id, wavesurfer: null, source: null }],
    }));

    const { addActionToHistory } = useMixerStore.getState();
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
}));

export default useMixerStore;
