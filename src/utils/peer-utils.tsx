import superjson from 'superjson';

import usePeerStore from '../stores/Peer';
import useMixerStore, { MixerState, TrackState } from '../stores/Mixer';

export const sendCmdToAllRemotePeers = (cmd: string, data: any) => {
  // send command to all connected remote peers
  const remotePeers = usePeerStore.getState().remote;
  console.log('sendCmdToAllRemotePeers', cmd, data, remotePeers);
  remotePeers.forEach((peer) => {
    console.log('send removeTrack to remote peer:', peer);
    peer.connection.send({
      cmd,
      data,
    });
  });
};

export const sendCurrentStateToAllRemotePeers = () => {
  // send the entire state to all connected remote peers
  const remotePeers = usePeerStore.getState().remote;

  const currentMixerActionHistory = useMixerStore.getState().history;

  //const syncableState = transformMixerStateSyncable(currentMixerTracksState);

  console.log(
    'sendCmdToAllRemotePeers',
    currentMixerActionHistory,
    remotePeers
  );
  remotePeers.forEach((peer) => {
    console.log('send sync to remote peer:', peer);
    peer.connection.send({
      cmd: 'sync',
      data: currentMixerActionHistory,
    });
  });
};

interface MixterStateSyncable {
  tracks: number[];
}
/* 
  MixerState cannot be immediately serialized because it contains nested prototypes, fns etc.
  transformMixerStateSyncable will take only the necessary data and make an object out of it
*/
export const transformMixerStateSyncable = (
  state: MixerState
): MixterStateSyncable => {
  return {
    tracks: state.tracks.map((track) => track.id),
  };
};
