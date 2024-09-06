import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.esm.js';
import RecordPlugin from 'wavesurfer.js/dist/plugins/record.esm.js';

import { useShallow } from 'zustand/react/shallow';
import useMixerStore from '../stores/Mixer';

import { sendCmdToAllRemotePeers } from '../utils/peer-utils';

import sampleWav from '../assets/StarWars60.wav';
import './AudioTrack.css';

type AudioTrackProps = {
  id: number;
};

function AudioTrack({ id }: AudioTrackProps) {
  console.log('AudioTrack render', id);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const setTrackWaveSurfer = useMixerStore((state) => state.setTrackWaveSurfer);
  const setTrackWaveSurferEventListener = useMixerStore(
    (state) => state.setTrackWaveSurferEventListener
  );
  const removeTrack = useMixerStore((state) => state.removeTrack);
  const [volumeWorkletNode, pcmProcessorNode, audioContext] = useMixerStore(
    useShallow((state) => [
      state.master.volumeWorkletNode,
      state.master.pcmProcessorNode,
      state.master.audioContext,
    ])
  );

  const trackWaveSurfer = useMixerStore(
    (state) => state.tracks.find((track) => track.id === id)?.wavesurfer
  );

  const recordPluginInstance = useRef<RecordPlugin>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!trackWaveSurfer) return;
    const recordPlugin = trackWaveSurfer.registerPlugin(
      RecordPlugin.create({
        scrollingWaveform: true,
        renderRecordedAudio: true,
        scrollingWaveformWindow: 60,
        audioContext,
      })
    );
    recordPlugin?.on('record-data-available', (blob) => {
      console.log('data', blob);
    });
    recordPluginInstance.current = recordPlugin;
    console.log('recordPlugin', recordPlugin);
    return () => {
      // cleanup listeners
      //recordPluginInstance.current.unAll();
    };
  }, [trackWaveSurfer]);

  useEffect(() => {
    console.log('create and set wavesurfer instance', id);
    const waveSurferInstance = WaveSurfer.create({
      audioContext,
      url: sampleWav,
      backend: 'WebAudio',
      container: `#waveform-${id}`,
      waveColor: '#47B784',
      //progressColor: "#EB9D9C",
      progressColor: '#CAAEEB',
      autoCenter: true,
      interact: true,
      fillParent: true,
    });
    setTrackWaveSurfer(id, waveSurferInstance);

    // the listenenr fns must be passed to the store with the exact ref to the fn
    // so that the .un and .on wavesurfer methods can be used properly
    const usePlay = () => {
      sendCmdToAllRemotePeers('play', {
        id,
      });
    };
    const usePause = () => {
      sendCmdToAllRemotePeers('pause', {
        id,
      });
    };
    const useSeek = (progress) => {
      sendCmdToAllRemotePeers('seekTo', {
        id,
        progress,
      });
    };
    setTrackWaveSurferEventListener(id, 'play', usePlay);
    setTrackWaveSurferEventListener(id, 'pause', usePause);
    setTrackWaveSurferEventListener(id, 'seeking', useSeek);

    // set the event hooks
    waveSurferInstance.on('play', usePlay);
    waveSurferInstance.on('pause', usePause);
    waveSurferInstance.on('seeking', useSeek);

    return () => {
      // cleanup
      waveSurferInstance.unAll();
    };
  }, []);

  // bind keypress listener not to window but to the container of this specific track
  useEffect(() => {
    const refForCleanup = containerRef.current;
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault();
        playPause();
      }
    };
    containerRef.current?.addEventListener('keydown', handleKeyPress);
    return () => {
      refForCleanup?.removeEventListener('keydown', handleKeyPress);
    };
  }, [play]);

  async function record() {
    console.log('click record', recordPluginInstance.current.isRecording());
    if (recordPluginInstance.current.isRecording()) {
      recordPluginInstance.current.stopRecording();

      const sourceNode = recordPluginInstance.current?.getSource();
      // disconnect any worklets so that they can pause processing when not needed
      sourceNode.disconnect(volumeWorkletNode);
      sourceNode.disconnect(pcmProcessorNode);
      setIsRecording(false);

      return;
    }
    console.log('about to record');

    // if rec has never been started on this track yet, start it to get a source node
    const deviceId =
      '9829f13f81c5d636ad4b8654b65656a448843234890f44659a71f67e98babd55';
    await recordPluginInstance.current.startRecording({
      deviceId,
    });
    console.log('recordPluginInstance.current', recordPluginInstance.current);
    const sourceNode = recordPluginInstance.current?.getSource();

    // connect worklets
    sourceNode.connect(volumeWorkletNode);
    sourceNode.connect(pcmProcessorNode);

    console.log('started recording!');
    setIsRecording(true);
  }

  async function playPause() {
    trackWaveSurfer?.playPause();
  }
  async function play() {
    trackWaveSurfer?.play();
  }

  async function pause() {
    trackWaveSurfer?.pause();
  }

  async function stop() {
    trackWaveSurfer?.stop();
    // stop doesn't have a wavesurfer hook, so send the cmd to remote peers here
    sendCmdToAllRemotePeers('stop', {
      id,
    });
  }

  function handleContainerFocus() {
    console.log('container focused!', id);
  }

  return (
    <>
      <div
        className="audio-track-container"
        tabIndex={id}
        ref={containerRef}
        onFocus={handleContainerFocus}
      >
        <span>{id} </span>
        <div className="audio-track-controls">
          <button onClick={record} tabIndex={-1}>
            {isRecording ? 'stop rec' : 'rec'}
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
          <button onClick={() => removeTrack({ id })} tabIndex={-1}>
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
  );
}

export default AudioTrack;
