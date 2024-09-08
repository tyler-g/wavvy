import { StateCreator } from 'zustand';
import FlacEncoderWorker from '../workers/encoder?worker';
import FlacDecoderWorker from '../workers/decoder?worker';
import ExporterUtilWorker from '../workers/exporter?worker';
import { sendCmdToAllRemotePeers } from '../utils/peer-utils';

import useMixerStore from './Mixer';

interface MasterState {
  db: number;
  audioContext: AudioContext | null;
  volumeWorkletNode: AudioWorkletNode | null;
  pcmProcessorNode: AudioWorkletNode | null;
  analyserNode: AnalyserNode | null;
}

export interface MasterSlice {
  master: MasterState;
  setupMasterAudioContext: () => void;
  setMasterVolumeWorkletNode: (node: AudioWorkletNode) => void;
  setPcmProcessorNode: (node: AudioWorkletNode) => void;
  setDb: (val: number) => void;
}

// TODO: move to util
/**
 *  create A-element for data BLOB
 */
function getDownloadLink(blob, filename, omitLinkLabel = false) {
  const name = filename || 'output.wav';
  const url = (window.URL || window.webkitURL).createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = name;
  if (!omitLinkLabel) {
    link.textContent = name;
  }
  return link;
}

function forceDownload(blob, filename) {
  const link = getDownloadLink(blob, filename, true);
  //NOTE: FireFox requires a MouseEvent (in Chrome a simple Event would do the trick)
  const click = document.createEvent('MouseEvent');
  click.initMouseEvent(
    'click',
    true,
    true,
    window,
    0,
    0,
    0,
    0,
    0,
    false,
    false,
    false,
    false,
    0,
    null
  );
  link.dispatchEvent(click);
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
    pcmProcessorNode: null,
  },
  setupMasterAudioContext: async () => {
    const { setDb, setMasterVolumeWorkletNode, setPcmProcessorNode } = get();

    const workerSlice = useMixerStore.getState();

    // set up master audio context and analyser
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 4096;
    analyser.connect(context.destination);

    // set up flac encoder and decoder workers, and exporter worker
    const flacEncoder = new FlacEncoderWorker();
    const flacDecoder = new FlacDecoderWorker();
    const exporterUtil = new ExporterUtilWorker();

    // init must wait until Flac onready event
    // TODO: do this without setTimeout
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
    flacDecoder.onmessage = (e) => {
      if (!e.data?.cmd) return;

      switch (e.data.cmd) {
        case 'export-wav':
          exporterUtil.postMessage({
            cmd: 'export-wav',
            buf: e.data.buf,
          });
      }
    };
    exporterUtil.onmessage = (e) => {
      let track1WaveSurferInstance;
      if (!e.data?.cmd) return;

      switch (e.data.cmd) {
        case 'wav-blob':
          console.log('got wav blob from exporter worker!', e.data.wav);
          forceDownload(e.data.wav, 'test.wav');

          // for testing only
          track1WaveSurferInstance =
            useMixerStore.getState().tracks[0].wavesurfer;
          track1WaveSurferInstance.loadBlob(e.data.wav);
          console.log(
            'track 1 duration',
            track1WaveSurferInstance.getDuration()
          );
      }
    };

    // save to state
    workerSlice.setWorkerEncoder(flacEncoder);
    workerSlice.setWorkerDecoder(flacDecoder);
    workerSlice.setWorkerExporter(exporterUtil);

    set((state) => ({
      master: {
        ...state.master,
        audioContext: context,
        analyserNode: analyser,
      },
    }));

    // set up audio worklets
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
          console.log('pcm msg', data);
          // send to flac encoder worker
          flacEncoder.postMessage({
            cmd: 'encode',
            buf: data,
          });
          // send to passthrough for other things that might need raw pcm data
          exporterUtil.postMessage({
            cmd: 'passthrough',
            pcm: data,
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
