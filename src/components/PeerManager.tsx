import { useRef, useEffect } from 'react';

import { useDisclosure } from '@mantine/hooks';
import { Modal, Button, Input, Center } from '@mantine/core';

import { Peer } from 'peerjs';
import { v4 as uuidv4 } from 'uuid';

import { useShallow } from 'zustand/react/shallow';
import usePeerStore from '../stores/Peer';
import useMixerStore, { MixerAction } from '../stores/Mixer';

import { sendCurrentStateToAllRemotePeers } from '../utils/peer-utils';

type PeerData = {
  cmd: setFns;
  data: unknown;
};
type setFns = 'addTrack' | 'removeTrack' | 'sync' | 'seekTo';

const waveSurferFns = ['play', 'pause', 'playPause', 'stop', 'seekTo'];

const PeerManager = () => {
  console.log('PeerManager render');
  const [opened, { open, close }] = useDisclosure(false);
  const remoteId = useRef('');

  const [me, setupMe, addRemotePeer, removeRemotePeer] = usePeerStore(
    useShallow((state) => [
      state.me.peer,
      state.setMePeer,
      state.addRemotePeer,
      state.removeRemotePeer,
    ])
  );

  useEffect(() => {
    const peer = new Peer(uuidv4());
    setupMe(peer);
    console.log('me', me);
  }, []);

  function handleIncomingData(obj: PeerData) {
    const { cmd, data } = obj;

    console.log('handleIncomingData', obj);
    // sync is a special case
    if (cmd === 'sync') {
      console.log('got a sync cmd!', data);
      if (data instanceof Array !== true) return;
      data.forEach((history: MixerAction) => {
        const { cmd, data } = history;
        const mixerCmdFn = useMixerStore.getState()[`${[cmd]}`];
        // pass true (isPeer param) so that store knows this came from a peer, and not to send cmd again, causing loop
        if (data) {
          mixerCmdFn(data, true);
        } else {
          mixerCmdFn(true);
        }
      });

      return;
    }

    // if it's wavesurfer cmd
    if (waveSurferFns.includes(cmd)) {
      const { data } = obj;
      // get the wavesurfer instance
      const waveSurferInstance = useMixerStore
        .getState()
        // eslint-disable-next-line
        // @ts-ignore
        .tracks.filter((track) => track.id === data?.id)[0].wavesurfer;

      console.log('waveSurferInstance', waveSurferInstance);

      if (!waveSurferInstance) return;

      if (cmd === 'seekTo') {
        // eslint-disable-next-line
        // @ts-ignore
        const { progress } = data;
        console.log('seekTo', progress);
        waveSurferInstance.seekTo(progress);
        return;
      }
      // call the fn on this instance
      waveSurferInstance[`${cmd}`]();

      return;
    }

    // store action cmds
    const mixerCmdFn = useMixerStore.getState()[`${cmd}`];
    // pass true (isPeer param) so that store knows this came from a peer, and not to send cmd again, causing loop
    if (data) {
      mixerCmdFn(data, true);
    } else {
      mixerCmdFn(true);
    }
  }

  useEffect(() => {
    if (!me) return;
    console.log('me updated!', me);
    me.on('connection', (conn) => {
      console.log('someone connected to me');
      conn.on('data', (obj) => {
        console.log('receiver getting data from sender', me.id, conn.peer);
        handleIncomingData(obj as PeerData);
      });
      conn.on('open', () => {
        // receiving side
        console.log('on open, receiver', conn);
        addRemotePeer(conn);
        // someone connected to me. sync my state to them
        sendCurrentStateToAllRemotePeers();
      });
      conn.on('close', () => {
        console.log('the originator disconnected');
        removeRemotePeer(conn);
      });
      conn.on('iceStateChanged', (state) => {
        if (state === 'disconnected') {
          console.log('originator closed the connection');
          // remote peer disconnected
          removeRemotePeer(conn);
        }
      });
    });
  }, [me]);

  function handleConnect() {
    if (!me?.id) return;
    console.log(
      `my peer ${me.id} connecting to remote peer ${remoteId.current}`
    );
    const conn = me.connect(remoteId.current);
    conn.on('data', (obj) => {
      console.log('sender getting data from receiver', me.id, conn.peer);
      handleIncomingData(obj as PeerData);
    });
    conn.on('open', () => {
      // sending side
      console.log('open! sender');
      addRemotePeer(conn);
    });
    conn.on('error', (err) => {
      console.error('error connect', err);
    });
    conn.on('close', () => {
      // this fires on refresh tab, but iceStateChanged only on close tab?
      console.log('remote peer disconnected');
      removeRemotePeer(conn);
    });
    conn.on('iceStateChanged', (state) => {
      console.log('remote peer closed the connection', state);
      if (state === 'disconnected') {
        console.log('remote peer closed the connection');
        // remote peer disconnected
        removeRemotePeer(conn);
      }
    });
  }
  return (
    <>
      <Modal opened={opened} onClose={close} title="Peer Manager">
        <Input placeholder={me?.id} defaultValue={me?.id} />
        <Input
          size="md"
          placeholder="remote peer's id"
          onChange={(e) => (remoteId.current = e.target.value)}
        />
        <Button onClick={handleConnect} variant="filled" color="cyan">
          Connect
        </Button>
      </Modal>
      <Center>
        <Button onClick={open} color="cyan">
          Open Network
        </Button>
      </Center>
    </>
  );
};

export default PeerManager;
