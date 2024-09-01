import { useEffect, useState } from 'react';
import useMixerStore from '../stores/Mixer';
import { useShallow } from "zustand/react/shallow"
import './MasterTrack.css';

function MasterTrack() {
  const setupMasterAudioContext = useMixerStore(state => state.setupMasterAudioContext)
  //const  [setMasterAudioContext, setMasterAnalyserNode] = useMixerStore(useShallow(state => [state.setMasterAudioContext, state.setMasterAnalyserNode]))

  // set the audio context
  useEffect(()=> {
    // chrome requires user interaction before audioContext will work, so do small delay 
    setTimeout(() => {
      setupMasterAudioContext();
    }, 1200)

  }, []);

  return (
    <>
      <div className='master-track-container'>
        <div className='master-track-controls'>
					MASTER TRACK
        </div>
      </div>
    </>
  );
}

export default MasterTrack;
