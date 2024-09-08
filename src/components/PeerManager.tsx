import { useRef, useEffect } from 'react';

import { useDisclosure } from '@mantine/hooks';
import { Modal, Button, Input, Center } from '@mantine/core';

import { Peer } from 'peerjs';
import { v4 as uuidv4 } from 'uuid';

import { useShallow } from 'zustand/react/shallow';
import usePeerStore from '../stores/Peer';
import useMixerStore from '../stores/Mixer';
import { MixerAction } from '../stores/HistorySlice';

import {
  sendCurrentStateToAllRemotePeers,
  sendCmdToAllRemotePeers,
} from '../utils/peer-utils';

import { WaveSurferEvents } from 'wavesurfer.js';

type PeerData = {
  cmd: string; //TODO: type out all possible cmds
  data: any;
};
//type setFns = 'addTrack' | 'removeTrack' | 'sync' | 'seekTo';

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

  const decoderWorker = useRef(useMixerStore.getState().workers.decoder);
  useEffect(
    () =>
      useMixerStore.subscribe(
        (state) => (decoderWorker.current = state.workers.decoder)
      ),
    []
  );

  useEffect(() => {
    const peer = new Peer(uuidv4());
    setupMe(peer);
    console.log('me', me);
  }, []);

  async function handleIncomingData(obj: PeerData) {
    const { cmd, data } = obj;

    console.log('handleIncomingData', obj);

    if (cmd === 'flac-chunk') {
      console.log('decode this flac-chunk from your peer!', data);
      decoderWorker.current.postMessage({
        cmd: 'decode',
        buf: data.buf,
      });

      return;
    }

    if (cmd === 'rec-end') {
      console.log('rec-end from your peer!');
      decoderWorker.current.postMessage({
        cmd: 'rec-end',
      });
      return;
    }

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

      if (cmd === 'seekTo') {
        const waveSurferSeekListenerFn = useMixerStore
          .getState()
          // eslint-disable-next-line
          // @ts-ignore
          .tracks.filter((track) => track.id === data?.id)[0]
          .wavesurferEventListeners['seeking'];
        // eslint-disable-next-line
        // @ts-ignore
        const { progress } = data;
        console.log('seekTo', progress);
        waveSurferInstance.un('seeking', waveSurferSeekListenerFn);
        // seekTo does not return a promise, so no await here
        // progress from the seeking event is given as the time in seconds,
        // but seekTo wants a percentage (between 0 and 1) *sigh*
        const seekToPosition = progress / waveSurferInstance.getDuration();
        waveSurferInstance.seekTo(seekToPosition);
        waveSurferInstance.on('seeking', waveSurferSeekListenerFn);
        return;
      }
      const waveSurferListenerFn = useMixerStore
        .getState()
        // eslint-disable-next-line
        // @ts-ignore
        .tracks.filter((track) => track.id === data?.id)[0]
        .wavesurferEventListeners[cmd];

      if (!waveSurferInstance) return;

      const eventName = `${cmd}` as keyof WaveSurferEvents;
      // unbind event listener so it doesn't trigger sending back to peers
      waveSurferInstance.un(eventName, waveSurferListenerFn);
      await waveSurferInstance[`${cmd}`]();
      // rebind after the promise has resolved and we know the event hook has already occurred
      waveSurferInstance.on(eventName, waveSurferListenerFn);

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
