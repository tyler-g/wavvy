import { StateCreator } from 'zustand';
import FlacEncoderWorker from '../workers/encoder?worker';
import FlacDecoderWorker from '../workers/decoder?worker';
import { sendCmdToAllRemotePeers } from '../utils/peer-utils';

interface WorkerState {
  encoder: Worker;
  decoder: Worker;
}

interface MasterState {
  db: number;
  audioContext: AudioContext | null;
  volumeWorkletNode: AudioWorkletNode | null;
  pcmProcessorNode: AudioWorkletNode | null;
  analyserNode: AnalyserNode | null;
}

export interface MasterSlice {
  workers: WorkerState;
  master: MasterState;
  setWorkerEncoder: (worker: Worker) => void;
  setWorkerDecoder: (worker: Worker) => void;
  setupMasterAudioContext: () => void;
  setMasterVolumeWorkletNode: (node: AudioWorkletNode) => void;
  setPcmProcessorNode: (node: AudioWorkletNode) => void;
  setDb: (val: number) => void;
}

export const createMasterSlice: StateCreator<
  MasterSlice,
  [],
  [],
  MasterSlice
> = (set, get) => ({
  workers: {
    encoder: null,
    decoder: null,
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
  master: {
    db: 0,
    audioContext: null,
    volumeWorkletNode: null,
    analyserNode: null,
    pcmProcessorNode: null,
  },
  setupMasterAudioContext: async () => {
    const {
      setDb,
      setMasterVolumeWorkletNode,
      setPcmProcessorNode,
      setWorkerEncoder,
      setWorkerDecoder,
    } = get();

    // set up master audio context and analyser
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 4096;
    analyser.connect(context.destination);

    // set up flac encoder and decoder workers
    const flacEncoder = new FlacEncoderWorker();
    const flacDecoder = new FlacDecoderWorker();

    // init must wait until Flac onready event
    setTimeout(() => {
      flacEncoder.postMessage({
        cmd: 'init',
      });
      flacDecoder.postMessage({
        cmd: 'init',
      });
    }, 2000);
    flacEncoder.onmessage = (e) => {
      if (!e.data?.cmd) return;

      switch (e.data.cmd) {
        case 'flac-chunk':
          // we got a wee bit of flac to decode mate
          console.log('flac-chunk', e.data);
          sendCmdToAllRemotePeers('flac-chunk', e.data);
          break;
      }
    };

    // save to state
    setWorkerEncoder(flacEncoder);
    setWorkerDecoder(flacDecoder);

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
        console.error('could not add module volume meter processor', err);
      });
    context.audioWorklet
      .addModule('src/worklets/pcm-processor.js')
      .then(async () => {
        const pcmProcessorNode = new AudioWorkletNode(
          context,
          'pcm-processor',
          {
            processorOptions: { encoderWorker: 1 },
          }
        );
        // because AudioWorklets can't currently create Workers inside them
        // we must receive the raw PCM data through onmessage, and on this
        // main thread, send it to the Flac Encoder Worker to be processed
        pcmProcessorNode.port.onmessage = ({ data }) => {
          // send to flac encoder worker
          flacEncoder.postMessage({
            cmd: 'encode',
            buf: data,
          });
        };
        setPcmProcessorNode(pcmProcessorNode);

        // this node doesn't need to connect to a destination
        // it's just meant to do heavy lossless encoding processing
      })
      .catch((err) => {
        console.error('could not add module pcm processor', err);
      });
  },
  setMasterVolumeWorkletNode: (node) => {
    set((state) => ({
      master: { ...state.master, volumeWorkletNode: node },
    }));
    console.log('setMasterVolumeWorkletNode', node);
  },
  setPcmProcessorNode: (node) => {
    set((state) => ({
      master: { ...state.master, pcmProcessorNode: node },
    }));
    console.log('setPcmProcessorNode', node);
  },
  setDb: (val) =>
    set((state) => ({
      master: {
        ...state.master,
        db: val,
      },
    })),
});
