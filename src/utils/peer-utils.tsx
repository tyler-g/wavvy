import usePeerStore from '../stores/Peer';
import useMixerStore from '../stores/Mixer';

export const sendCmdToAllRemotePeers = (cmd: string, data: any = null) => {
  // send command to all connected remote peers
  const remotePeers = usePeerStore.getState().remote;
  if (!remotePeers.length) return;
  console.log('sendCmdToAllRemotePeers', cmd, data, remotePeers);
  remotePeers.forEach((peer) => {
    peer.connection.send({
      cmd,
      data,
    });
  });
};

export const sendCurrentStateToAllRemotePeers = () => {
  const remotePeers = usePeerStore.getState().remote;
  const currentMixerActionHistory = useMixerStore.getState().history;

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
