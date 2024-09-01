import { useDisclosure } from '@mantine/hooks';
import { Modal, Button, Input, Center } from '@mantine/core';
import { Peer } from "peerjs";
import { useRef, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import usePeerStore from '../stores/Peer';
import useMixerStore from '../stores/Mixer';
import { useShallow } from "zustand/react/shallow"

type PeerData = {
	cmd: setFns,
	data: unknown
}
type setFns = 'addTrack' | 'removeTrack';

const PeerManager = () => {
	console.log('PeerManager reder');
	const [opened, { open, close }] = useDisclosure(false);
	const remoteId = useRef('');

	const  [me, setupMe, addRemotePeer] = usePeerStore(useShallow(state => [state.me.peer, state.setMePeer, state.addRemotePeer]))

	useEffect(() => {
		const peer = new Peer(uuidv4());
		setupMe(peer);
		console.log('me', me);
	}, [])

	function handleIncomingData(obj: PeerData) {
		const { cmd, data } = obj;
		const mixerCmdFn = useMixerStore.getState()[[cmd]];
		
		// pass true (isPeer param) so that store knows this came from a peer, and not to send cmd again, causing loop
		if (data) {
			mixerCmdFn(data, true);
		} else {
			mixerCmdFn(true);
		}

	}


	useEffect(() =>{
		if (!me) return;
		console.log('me updated!', me)
		me.on("connection", (conn) => {
			conn.on("data", (obj) => {
				console.log('receiver getting data from sender', me.id, conn.peer);
				handleIncomingData(obj as PeerData)
			});
			conn.on("open", () => {
				// receiving side
				console.log('on open, receiver', conn);
				addRemotePeer(conn)
			});
		});
		me.on("disconnected", (id)=> {
			console.log('me disconnected!')
		})
	}, [me])

	function handleConnect() {
		if (!me?.id) return;
		console.log(`my peer ${me.id} connecting to remote peer ${remoteId.current}`)
		const conn = me.connect(remoteId.current);
		conn.on("data", (obj)=> {
			console.log('sender getting data from receiver', me.id, conn.peer)
			handleIncomingData(obj as PeerData)
		})
		conn.on("open", () => {
			// sending side
			console.log('open! sender')
			addRemotePeer(conn)
		});
		conn.on("error", (err) => {
			console.error('error connect', err)
		})

	}
return (
	<>
      <Modal opened={opened} onClose={close} title="Peer Manager">
				<Input placeholder={me?.id} defaultValue={me?.id} />
				<Input size="md" placeholder="remote peer's id" onChange={(e) => remoteId.current = e.target.value} />
				<Button onClick={handleConnect} variant="filled" color="cyan">Connect</Button>
      </Modal>
			<Center>
			<Button onClick={open} color="cyan">Open Network</Button>
			</Center>
	</>
)
}

export default PeerManager