import useMixerStore from '../stores/Mixer';

const AudioTrackManager = () => {
  console.log('AudioTrackManager render');
  const addTrack = useMixerStore((state) => state.addTrack);

  function daddTrack() {
    console.log('addTrack btn clicked');
    addTrack();
  }

  return (
    <div>
      <button onClick={daddTrack}>add </button>
    </div>
  );
};

export default AudioTrackManager;
