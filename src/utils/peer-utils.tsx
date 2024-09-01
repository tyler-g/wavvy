import usePeerStore from "../stores/Peer"

export const sendCmdToAllRemotePeers = (cmd: string, data: any) => {
		// send command to all connected remote peers
		const remotePeers = usePeerStore.getState().remote;
		console.log('sendCmdToAllRemotePeers', cmd, data, remotePeers);
		remotePeers.forEach((peer)=> {
			console.log('send removeTrack to remote peer:', peer)
			peer.connection.send({
				cmd,
				data
			})
		});
}