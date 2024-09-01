import { useEffect, useRef, useState } from "react"
import WaveSurfer from "wavesurfer.js"
import TimelinePlugin from "wavesurfer.js/dist/plugins/timeline.esm.js"
//import RecordPlugin from "wavesurfer.js/dist/plugins/record.esm.js"

import useMixerStore from "../stores/Mixer"
import { useShallow } from "zustand/react/shallow"

import "./AudioTrack.css"

type AudioTrackProps = {
  id: number
}

function AudioTrack({ id }: AudioTrackProps) {
  console.log("AudioTrack render", id)
  const setTrackWaveSurfer = useMixerStore(state => state.setTrackWaveSurfer)
  const setTrackSource = useMixerStore(state => state.setTrackSource)

  const removeTrack = useMixerStore(state => state.removeTrack)
  const  [masterAudioContext] = useMixerStore(useShallow(state => [state.master.audioContext]))

  const trackWaveSurfer = useMixerStore(
    state => state.tracks.find(track => track.id === id)?.wavesurfer,
  )

  const containerRef = useRef<HTMLElement>(null)

  const plugins: any = []
  plugins.push(
    TimelinePlugin.create({
      container: `#waveform-timeline-${id}`,
    }),
  )

  // bind keypress listener not to window but to the container of this specific track
  useEffect(() => {
    const refForCleanup = containerRef.current
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault()
        playPause()
      }
    }
    containerRef.current?.addEventListener("keydown", handleKeyPress)
    return () => {
      refForCleanup?.removeEventListener("keydown", handleKeyPress)
    }
  }, [play])

  useEffect(() => {
    console.log("create and set wavesurfer instance", id)
    const waveSurferInstance = WaveSurfer.create({
      url: "src/assets/StarWars60.wav",
      backend: 'WebAudio',
      container: `#waveform-${id}`,
      waveColor: "#47B784",
      //progressColor: "#EB9D9C",
      progressColor: "#CAAEEB",
      autoCenter: true,
      interact: true,
      fillParent: true,
    })
    setTrackWaveSurfer(id, waveSurferInstance)
    return () => {
      // cleanup
    }
  }, [])

  async function record() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      })

      setTrackSource(id, stream)
    } catch (err) {
      console.error("could not get audio stream!", err)
    }
  }

  async function playPause() {
    trackWaveSurfer?.playPause()
  }
  async function play() {
    console.log("play", trackWaveSurfer)
    trackWaveSurfer?.play()
  }

  async function pause() {
    console.log("pause")
    trackWaveSurfer?.pause()
  }

  async function stop() {
    console.log("stop")
    trackWaveSurfer?.stop()
  }

  function handleContainerFocus() {
    console.log("container focused!", id)
  }

  return (
    <>
      <div
        className="audio-track-container"
        tabIndex={id}
        ref={containerRef}
        onFocus={handleContainerFocus}
      >
        <div className="audio-track-controls">
          <button onClick={record} tabIndex={-1}>
            rec
          </button>
          <button onClick={play} tabIndex={-1}>
            play
          </button>
          <button onClick={pause} tabIndex={-1}>
            pause
          </button>
          <button onClick={stop} tabIndex={-1}>
            stop
          </button>
          <button onClick={() => removeTrack({id})} tabIndex={-1}>
            remove
          </button>
        </div>
        <div className="audio-track">
          <div id={`waveform-editor${id}`}></div>
          <div id={`waveform-${id}`}></div>
          <div id={`waveform-timeline-${id}`}></div>
        </div>
      </div>
    </>
  )
}

export default AudioTrack
