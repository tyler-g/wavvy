import { StateCreator } from 'zustand';

interface MasterState {
  db: number;
  audioContext: AudioContext | null;
  volumeWorkletNode: AudioWorkletNode | null;
  analyserNode: AnalyserNode | null;
}

export interface MasterSlice {
  master: MasterState;
  setupMasterAudioContext: () => void;
  setMasterVolumeWorkletNode: (node: AudioWorkletNode) => void;
  setDb: (val: number) => void;
}

export const createMasterSlice: StateCreator<
  MasterSlice,
  [],
  [],
  MasterSlice
> = (set, get) => ({
  master: {
    db: 0,
    audioContext: null,
    volumeWorkletNode: null,
    analyserNode: null,
  },
  setupMasterAudioContext: async () => {
    const { setDb, setMasterVolumeWorkletNode } = get();

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
          console.log('volume msg', data);
          setDb(data);
        };
        setMasterVolumeWorkletNode(volumeMeterNode);
        volumeMeterNode.connect(analyser);
      })
      .catch((err) => {
        console.error('could not add volume meter processor', err);
      });
  },
  setMasterVolumeWorkletNode: (node) => {
    set((state) => ({
      master: { ...state.master, volumeWorkletNode: node },
    }));
    console.log('setMasterVolumeWorkletNode', node);
  },
  setDb: (val) =>
    set((state) => ({
      master: {
        ...state.master,
        db: val,
      },
    })),
});
