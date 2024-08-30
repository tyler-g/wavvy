import { useEffect, useState } from 'react';
import useMixerStore from '../stores/Mixer';
import './MasterTrack.css';

function MasterTrack() {
  const setMasterAudioContext = useMixerStore(state => state.setMasterAudioContext)

  // set the audio context
  useEffect(()=> {

    // chrome requires user interaction before audioContext will work, so do small delay 
    setTimeout(() => {
      const audioContext = new AudioContext();
      console.log('setting master context', audioContext)
      setMasterAudioContext(audioContext)
    }, 1000)

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
