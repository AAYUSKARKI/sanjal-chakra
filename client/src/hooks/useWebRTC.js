import { useEffect, useRef, useState } from 'react';
import { socket } from '../utils/socket';

const useWebRTC = (userId, targetId, isGroupCall = false, groupMembers = []) => {
  const localVideoRef = useRef(null);
  const remoteVideoRefs = useRef({});
  const peerConnectionsRef = useRef({});
  const candidatesRef = useRef({});
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [isVideoCallActive, setIsVideoCallActive] = useState(false);
  const [callStatus, setCallStatus] = useState('');
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [isCallEnded, setIsCallEnded] = useState(false);
  const [callInitiator, setCallInitiator] = useState(false);
  const remoteStreamIdsRef = useRef({});

  // Initialize remoteVideoRefs only when necessary
  useEffect(() => {
    const newRefs = {};
    if (isGroupCall) {
      groupMembers
        .filter(member => member._id !== userId)
        .forEach(member => {
          newRefs[member._id] = remoteVideoRefs.current[member._id] || { current: null };
        });
    } else if (targetId) {
      newRefs[targetId] = remoteVideoRefs.current[targetId] || { current: null };
    }
    remoteVideoRefs.current = newRefs;
    console.log('Initialized remoteVideoRefs:', remoteVideoRefs.current);
  }, [userId, targetId, isGroupCall, groupMembers.map(m => m._id).join(',')]);

  const createPeerConnection = (remoteUserId) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && !isCallEnded) {
        console.log(`Sending ICE candidate to ${remoteUserId}:`, event.candidate);
        socket.emit('peer-negotiation-needed', {
          to: remoteUserId,
          candidate: event.candidate.toJSON(),
          groupId: isGroupCall ? targetId : null,
        });
      }
    };

    pc.ontrack = (event) => {
      console.log(`Received remote track from ${remoteUserId}:`, event.streams);
      const [remote] = event.streams;
      if (remote) {
        if (remoteStreamIdsRef.current[remoteUserId] === remote.id) {
          console.log(`Skipping duplicate remote stream from ${remoteUserId}:`, remote.id);
          return;
        }
        console.log(`Remote stream tracks from ${remoteUserId}:`, remote.getTracks());
        remote.getTracks().forEach(track => {
          console.log(`Track kind: ${track.kind}, enabled: ${track.enabled}, readyState: ${track.readyState}`);
          if (track.kind === 'video') {
            console.log(`Video track details: width=${track.getSettings().width}, height=${track.getSettings().height}, frameRate=${track.getSettings().frameRate}`);
          }
        });
        remoteStreamIdsRef.current[remoteUserId] = remote.id;
        setRemoteStreams(prev => ({ ...prev, [remoteUserId]: remote }));
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection state for ${remoteUserId}:`, pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        setCallStatus(`Connection to ${remoteUserId} disconnected. Attempting to reconnect...`);
        setTimeout(() => {
          if (pc.iceConnectionState !== 'connected') {
            endVideoCall();
          }
        }, 5000);
      } else if (pc.iceConnectionState === 'connected') {
        setCallStatus('Connected');
      }
    };

    pc.onsignalingstatechange = () => {
      console.log(`Signaling state for ${remoteUserId}:`, pc.signalingState);
      if (pc.signalingState === 'closed') {
        endVideoCall();
      }
    };

    return pc;
  };

  const processQueuedCandidates = async (remoteUserId) => {
    const pc = peerConnectionsRef.current[remoteUserId];
    if (pc) {
      while (candidatesRef.current[remoteUserId]?.length) {
        const candidate = candidatesRef.current[remoteUserId].shift();
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
          console.log(`Added queued ICE candidate for ${remoteUserId}:`, candidate);
        } catch (error) {
          console.error(`Error adding queued ICE candidate for ${remoteUserId}:`, error);
        }
      }
    }
  };

  const startVideoCall = async () => {
    try {
      setCallStatus('Calling...');
      setIsCallEnded(false);
      setCallInitiator(true);
      candidatesRef.current = {};
      remoteStreamIdsRef.current = {};
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      }).catch(error => {
        throw new Error('Permission denied or device unavailable');
      });
      stream.getVideoTracks().forEach(track => {
        track.enabled = true;
        console.log('Video track enabled:', track.enabled);
      });
      setLocalStream(stream);
      console.log('Local stream obtained:', stream);

      setIsVideoCallActive(true);
      if (isGroupCall) {
        peerConnectionsRef.current = {};
        groupMembers
          .filter(member => member._id !== userId)
          .forEach(member => {
            const remoteUserId = member._id;
            peerConnectionsRef.current[remoteUserId] = createPeerConnection(remoteUserId);
            candidatesRef.current[remoteUserId] = [];
            stream.getTracks().forEach(track => {
              peerConnectionsRef.current[remoteUserId].addTrack(track, stream);
            });
          });

        await Promise.all(
          Object.keys(peerConnectionsRef.current).map(async (remoteUserId) => {
            const pc = peerConnectionsRef.current[remoteUserId];
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('user-call', {
              to: remoteUserId,
              offer,
              groupId: targetId,
            });
          })
        );
        setCallStatus('Connecting to group...');
      } else {
        peerConnectionsRef.current[targetId] = createPeerConnection(targetId);
        candidatesRef.current[targetId] = [];
        stream.getTracks().forEach(track => {
          peerConnectionsRef.current[targetId].addTrack(track, stream);
        });
        const offer = await peerConnectionsRef.current[targetId].createOffer();
        await peerConnectionsRef.current[targetId].setLocalDescription(offer);
        socket.emit('user-call', { to: targetId, offer });
        setCallStatus('Connecting...');
      }
    } catch (error) {
      console.error('Error starting video call:', error);
      setCallStatus(error.message === 'Permission denied or device unavailable'
        ? 'Camera or microphone access denied. Please grant permissions and try again.'
        : 'Failed to start call. Check camera/microphone permissions and try again.');
      endVideoCall();
    }
  };

  const acceptCall = async ({ from, offer, groupId }) => {
    try {
      setCallStatus('Accepting call...');
      setIsCallEnded(false);
      setCallInitiator(false);
      candidatesRef.current[from] = [];
      remoteStreamIdsRef.current[from] = null;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      }).catch(error => {
        throw new Error('Permission denied or device unavailable');
      });
      stream.getVideoTracks().forEach(track => {
        track.enabled = true;
        console.log('Video track enabled:', track.enabled);
      });
      setLocalStream(stream);
      console.log('Local stream obtained:', stream);

      setIsVideoCallActive(true);
      peerConnectionsRef.current[from] = createPeerConnection(from);
      stream.getTracks().forEach(track => {
        peerConnectionsRef.current[from].addTrack(track, stream);
      });

      await peerConnectionsRef.current[from].setRemoteDescription(new RTCSessionDescription(offer));
      await processQueuedCandidates(from);
      const answer = await peerConnectionsRef.current[from].createAnswer();
      await peerConnectionsRef.current[from].setLocalDescription(answer);
      socket.emit('call-accepted', { to: from, answer, groupId });

      setIncomingCall(null);
      setCallStatus('Connected');
    } catch (error) {
      console.error('Error accepting call:', error);
      setCallStatus(error.message === 'Permission denied or device unavailable'
        ? 'Camera or microphone access denied. Please grant permissions and try again.'
        : 'Failed to accept call. Check camera/microphone permissions.');
      setIncomingCall(null);
      endVideoCall();
    }
  };

  const rejectCall = (callId) => {
    if (incomingCall) {
      socket.emit('call-rejected', { to: incomingCall.from, callId, groupId: isGroupCall ? targetId : null });
      setIncomingCall(null);
      setCallStatus('Call rejected.');
      setIsCallEnded(true);
      endVideoCall();
      console.log('rejectCall: Initiated call rejection and cleanup');
    }
  };

  const endVideoCall = () => {
    if (isCallEnded) {
      console.log('endVideoCall: Call already ended, skipping cleanup');
      return;
    }
    setIsCallEnded(true);
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped track:', track.kind);
      });
    }
    Object.values(peerConnectionsRef.current).forEach(pc => {
      pc.close();
    });
    peerConnectionsRef.current = {};
    setLocalStream(null);
    setRemoteStreams({});
    setIsVideoCallActive(false);
    setIncomingCall(null);
    setCallStatus('');
    setCallInitiator(false);
    candidatesRef.current = {};
    remoteStreamIdsRef.current = {};
    if (callInitiator || isVideoCallActive) {
      socket.emit('end-call', { to: isGroupCall ? groupMembers.map(m => m._id).filter(id => id !== userId) : [targetId], groupId: isGroupCall ? targetId : null });
      console.log('endVideoCall: Emitted end-call to', isGroupCall ? 'group members' : targetId);
    }
    console.log('endVideoCall: Camera and stream cleanup completed');
  };

  const toggleMic = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMicOn(prev => !prev);
    }
  };

  const toggleCamera = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
        console.log('Toggled video track:', track.enabled);
      });
      setIsCameraOn(prev => !prev);
    }
  };

  const toggleFullScreen = () => {
    const element = document.getElementById('video-call-container') || document.documentElement;
    if (!isFullScreen) {
      element.requestFullscreen().catch(err => console.error('Full-screen error:', err));
    } else {
      document.exitFullscreen().catch(err => console.error('Exit full-screen error:', err));
    }
    setIsFullScreen(prev => !prev);
  };

  useEffect(() => {
    if (userId) {
      socket.on('incoming-call', ({ from, offer, callId, groupId }) => {
        if (!isVideoCallActive && !isCallEnded) {
          setIncomingCall({ from, offer, callId, groupId });
          setCallStatus('Incoming call...');
        } else {
          socket.emit('call-rejected', { to: from, callId, groupId });
        }
      });

      socket.on('call-accepted', async ({ answer, callId, from, groupId }) => {
        try {
          const pc = peerConnectionsRef.current[from];
          if (pc && pc.signalingState !== 'closed') {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
            await processQueuedCandidates(from);
            setCallStatus('Connected');
          } else {
            console.warn(`Cannot set remote description for ${from}: Peer connection is closed or null`);
            setCallStatus('Call failed: Connection closed.');
            endVideoCall();
          }
        } catch (error) {
          console.error(`Error handling call-accepted from ${from}:`, error);
          setCallStatus('Failed to connect call.');
          endVideoCall();
        }
      });

      socket.on('call-rejected', ({ callId }) => {
        setCallStatus('Call rejected by user.');
        endVideoCall();
      });

      socket.on('peer-negotiation-needed', ({ candidate, callId, from, groupId }) => {
        console.log(`Received ICE candidate from ${from}:`, candidate);
        if (!candidate) return;
        const pc = peerConnectionsRef.current[from];
        if (pc && pc.remoteDescription && pc.signalingState !== 'closed') {
          pc.addIceCandidate(new RTCIceCandidate(candidate))
            .then(() => console.log(`Added ICE candidate from ${from} successfully`))
            .catch(error => console.error(`Error adding ICE candidate from ${from}:`, error));
        } else {
          candidatesRef.current[from] = candidatesRef.current[from] || [];
          candidatesRef.current[from].push(candidate);
          console.log(`Queued ICE candidate from ${from}:`, candidate);
        }
      });

      socket.on('end-call', ({ callId }) => {
        setCallStatus('Call ended by remote user.');
        endVideoCall();
      });

      socket.on('user-offline', ({ userId: offlineUserId }) => {
        if (!isGroupCall && offlineUserId === targetId) {
          setCallStatus('User is offline.');
          endVideoCall();
        } else if (isGroupCall && groupMembers.some(m => m._id === offlineUserId)) {
          setCallStatus(`User ${offlineUserId} is offline.`);
          delete peerConnectionsRef.current[offlineUserId];
          setRemoteStreams(prev => {
            const newStreams = { ...prev };
            delete newStreams[offlineUserId];
            return newStreams;
          });
        }
      });

      return () => {
        socket.off('incoming-call');
        socket.off('call-accepted');
        socket.off('call-rejected');
        socket.off('peer-negotiation-needed');
        socket.off('end-call');
        socket.off('user-offline');
      };
    }
  }, [userId, targetId, isGroupCall, groupMembers]);

  return {
    localVideoRef,
    remoteVideoRefs,
    startVideoCall,
    endVideoCall,
    acceptCall,
    rejectCall,
    isVideoCallActive,
    callStatus,
    incomingCall,
    toggleMic,
    toggleCamera,
    isMicOn,
    isCameraOn,
    toggleFullScreen,
    isFullScreen,
    localStream,
    remoteStreams,
  };
};

export default useWebRTC;