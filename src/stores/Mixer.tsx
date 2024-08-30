import { create } from "zustand"
import type WaveSurferType from "wavesurfer.js"
import WaveSurfer from "wavesurfer.js"

interface MasterState {
  db: number
  audioContext: AudioContext | null
  volumeWorkletNode: AudioWorkletNode | null
}

interface TrackState {
  id: number
  wavesurfer: WaveSurfer | null
  source: MediaStream | null
}

interface MixerState {
  master: MasterState
  setMasterAudioContext: (context: AudioContext) => void
  setMasterVolumeWorkletNode: (node: AudioWorkletNode) => void
  tracks: TrackState[]
  setDb: (val: number) => void
  setTrackWaveSurfer: (id: number, instance: WaveSurferType) => void
  setTrackSource: (id: number, stream: MediaStream) => void
  addTrack: () => void
  removeTrack: (id: number) => void
}

const useMixerStore = create<MixerState>(set => ({
  master: {
    db: 0,
    audioContext: null,
    volumeWorkletNode: null,
  },
  tracks: [] as TrackState[],
  setMasterVolumeWorkletNode: (node) => {
    set((state) => ({
      master: {...state.master, volumeWorkletNode: node},
    }))
    console.log('setMasterVolumeWorkletNode', node);
  },
  setMasterAudioContext: (context) => {
    const { setDb, setMasterVolumeWorkletNode} = useMixerStore.getState();
    set((state) => ({
      master: {...state.master, audioContext: context},
    }))
    context.audioWorklet
      .addModule("src/worklets/volume-meter-processor.js")
      .then(async () => {
        console.log("added module volume meter processor"!)
        const volumeMeterNode = new AudioWorkletNode(
          context,
          "volume-meter",
        )
        volumeMeterNode.port.onmessage = ({ data }) => {
          console.log('on volume', data)
          //setDb(data);
        }
        //setMasterVolumeWorkletNode(volumeMeterNode);
        // connect chain
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        })
        const streamSource = context.createMediaStreamSource(stream)
        streamSource.connect(volumeMeterNode).connect(context.destination)
      })
      .catch(err => {
        console.error("could not add volume meter processor", err)
      })
  },
  setDb: val => set((state) => ({ master: {
    ...state.master,
    db: val
  }})),
  setTrackWaveSurfer: (id, instance) => {
    const tracks = useMixerStore.getState().tracks
    const trackIndexWithThisId = tracks.findIndex(track => track.id === id)
    const newTracks = [...tracks]
    newTracks[trackIndexWithThisId].wavesurfer = instance
    set(state => ({
      tracks: [...newTracks],
    }))
  },
  setTrackSource: (id, stream) => {
    
    const masterState = useMixerStore.getState().master;
    console.log('hey', masterState.audioContext, masterState.volumeWorkletNode) 
    const tracks = useMixerStore.getState().tracks
    const trackIndexWithThisId = tracks.findIndex(track => track.id === id)
    const newTracks = [...tracks]
    newTracks[trackIndexWithThisId].source = stream

    const streamSource = masterState.audioContext?.createMediaStreamSource(stream);
    console.log('streamSource', streamSource);
    if (masterState.volumeWorkletNode && masterState.audioContext?.destination) {
      const ok = streamSource?.connect(masterState.volumeWorkletNode).connect(masterState.audioContext.destination)
      console.log('connect the dots', ok);
    };
    
    set(state => ({
      tracks: [...newTracks],
    }))
  },
  addTrack: () => {
    const tracks = useMixerStore.getState().tracks
    const id = tracks.length + 1
    set(state => ({
      tracks: [...state.tracks, { id, wavesurfer: null, source: null}],
    }))
  },
  removeTrack: id => {
    set(state => ({
      tracks: [...state.tracks].filter(track => track.id !== id),
    }))
  },
}))

export default useMixerStore
