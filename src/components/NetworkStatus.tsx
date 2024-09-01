import './NetworkStatus.css';
import { useState, useEffect } from 'react';
import { Drawer, List, rem} from '@mantine/core';
import { useHover } from '@mantine/hooks';
import { useDisclosure } from '@mantine/hooks';
import { IconAffiliate } from '@tabler/icons-react';
import usePeerStore from '../stores/Peer';
import { useShallow } from "zustand/react/shallow";

const NetworkStatus = () => {
	console.log('NetworkStatus render');
	const [color, setColor] = useState('white');
  const [opened, { open, close }] = useDisclosure(false);
	const { hovered, ref } = useHover();

	const myPeerId = usePeerStore(state => state.me?.peer?.id)
	const remotePeers = usePeerStore(useShallow((state) => state.remote))
	const isConnected = remotePeers.length ? true : false;

	useEffect(()=> {
		setColor(isConnected ? '#47B784' : 'white');
	}, [isConnected])

	return (
		<div className="network-status">
			<Drawer opened={opened} onClose={close} title="Network Status">
				<p>My Peer Id: {myPeerId}</p>
				<p>Connected?: {isConnected ? 'Yes' : 'No'}</p>
				Remote Peers:
				<List size="sm">
					{remotePeers.map(peer => (
						<List.Item key={peer.connection.peer}>{peer.connection.peer}</List.Item>
					))}
				</List>
			</Drawer>
			<IconAffiliate
				ref={ref}
				onClick={open}
				style={{ width: rem(40), height: rem(40) }}
				color={color}
				stroke={hovered? 2 : 1}
			/>
		</div>
	)	
}

export default NetworkStatus