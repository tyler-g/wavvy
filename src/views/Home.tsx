import AudioTrack from '../components/AudioTrack';
import MasterMeter from '../components/MasterMeter';
import MasterTrack from '../components/MasterTrack';
import AudioTrackManager from '../components/AudioTrackManager';
import PeerManager from '../components/PeerManager';
import NetworkStatus from '../components/NetworkStatus';

import { useShallow } from 'zustand/react/shallow';
import useMixerStore from '../stores/Mixer';

const Home = () => {
  console.log('Home view render');
  const [tracks] = useMixerStore(useShallow((state) => [state.tracks]));

  return (
    <>
      <NetworkStatus></NetworkStatus>
      <AudioTrackManager></AudioTrackManager>
      {tracks.map((track) => (
        <AudioTrack key={track.id} id={track.id}></AudioTrack>
      ))}
      <MasterTrack></MasterTrack>
      <MasterMeter></MasterMeter>
      <PeerManager></PeerManager>
    </>
  );
};

export default Home;
