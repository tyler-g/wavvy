import { create } from 'zustand';
import { DataConnection, Peer } from 'peerjs';

interface RemoteState {
  connection: DataConnection;
}

interface MeState {
  peer: Peer | null;
}

interface PeerState {
  me: MeState;
  remote: RemoteState[];
  setMePeer: (peer: Peer) => void;
  addRemotePeer: (connection: DataConnection) => void;
}

const usePeerStore = create<PeerState>((set) => ({
  me: {
    peer: null,
  },
  remote: [],
  setMePeer: (peer) => {
    set((state) => ({
      me: { ...state.me, peer },
    }));
    console.log('setMePeer', peer);
  },
  addRemotePeer: (connection) => {
    set((state) => ({
      remote: [...state.remote, { connection }],
    }));
    console.log('addRemotePeer', connection);
  },
}));

export default usePeerStore;
