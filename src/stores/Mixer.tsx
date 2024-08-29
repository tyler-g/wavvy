import { create } from "zustand"
import type WaveSurferType from "wavesurfer.js"
import WaveSurfer from "wavesurfer.js"

interface MasterState {
  db: number
  audioContext: AudioContext | null
}

interface MixerState {
  master: MasterState
  tracks: TrackState[]
  db: number
  setDb: (val: number) => void
  setTrackWaveSurfer: (id: number, instance: WaveSurferType) => void
  addTrack: () => void
  removeTrack: (id: number) => void
}

interface TrackState {
  id: number
  wavesurfer: WaveSurfer | null
}

const useMixerStore = create<MixerState>(set => ({
  master: {
    db: 0,
    audioContext: null,
  },
  tracks: [] as TrackState[],
  db: 0,
  setDb: val => set(() => ({ db: val })),
  setTrackWaveSurfer: (id, instance) => {
    const tracks = useMixerStore.getState().tracks
    const trackIndexWithThisId = tracks.findIndex(track => track.id === id)
    const newTracks = [...tracks]
    newTracks[trackIndexWithThisId].wavesurfer = instance
    set(state => ({
      tracks: [...newTracks],
    }))
  },
  addTrack: () => {
    const tracks = useMixerStore.getState().tracks
    const id = tracks.length + 1
    set(state => ({
      tracks: [...state.tracks, { id, wavesurfer: null }],
    }))
  },
  removeTrack: id => {
    set(state => ({
      tracks: [...state.tracks].filter(track => track.id !== id),
    }))
  },
}))

export default useMixerStore
