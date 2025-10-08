import { useEffect, useRef, useState } from 'react';
import { socket } from '../utils/socket';

const useWebRTC = (userId, remoteUserId) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const candidatesRef = useRef([]);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isVideoCallActive, setIsVideoCallActive] = useState(false);
  const [callStatus, setCallStatus] = useState('');
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [isCallEnded, setIsCallEnded] = useState(false); // Flag to prevent processing stale events

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        // Add TURN servers for better reliability in production (e.g., from Twilio or your own)
      ],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && !isCallEnded) {
        console.log('Sending ICE candidate:', event.candidate);
        socket.emit('peer-negotiation-needed', {
          to: remoteUserId,
          candidate: event.candidate.toJSON(), // Ensure candidate is serializable
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('Received remote stream:', event.streams);
      const [remote] = event.streams;
      setRemoteStream(remote);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remote;
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        setCallStatus('Call disconnected due to network issues. Attempting to reconnect...');
        // Optional: Implement auto-reconnect logic here if desired
        setTimeout(() => {
          if (pc.iceConnectionState !== 'connected') {
            endVideoCall();
          }
        }, 5000); // Give 5s for reconnection
      } else if (pc.iceConnectionState === 'connected') {
        setCallStatus('Connected');
      }
    };

    pc.onsignalingstatechange = () => {
      console.log('Signaling state:', pc.signalingState);
      if (pc.signalingState === 'closed') {
        endVideoCall();
      }
    };

    return pc;
  };

  const processQueuedCandidates = async () => {
    const pc = peerConnectionRef.current;
    if (pc) {
      while (candidatesRef.current.length) {
        const candidate = candidatesRef.current.shift();
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
          console.log('Added queued ICE candidate:', candidate);
        } catch (error) {
          console.error('Error adding queued ICE candidate:', error);
        }
      }
    }
  };

  const startVideoCall = async () => {
    try {
      setCallStatus('Calling...');
      setIsCallEnded(false);
      candidatesRef.current = []; // Reset queue
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' }, // Prefer front camera
        audio: true,
      });
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      peerConnectionRef.current = createPeerConnection();
      stream.getTracks().forEach((track) => {
        peerConnectionRef.current.addTrack(track, stream);
      });

      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
      socket.emit('user-call', { to: remoteUserId, offer: offer }); // Serialize offer

      setIsVideoCallActive(true);
      setCallStatus('Connecting...');
    } catch (error) {
      console.error('Error starting video call:', error);
      setCallStatus('Failed to start call. Check camera/microphone permissions and try again.');
      endVideoCall();
    }
  };

  const acceptCall = async ({ from, offer }) => {
    try {
      setCallStatus('Accepting call...');
      setIsCallEnded(false);
      candidatesRef.current = []; // Reset queue
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true,
      });
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      peerConnectionRef.current = createPeerConnection();
      stream.getTracks().forEach((track) => {
        peerConnectionRef.current.addTrack(track, stream);
      });

      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
      await processQueuedCandidates(); // Process any early candidates
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      socket.emit('call-accepted', { to: from, answer: answer }); // Serialize answer

      setIsVideoCallActive(true);
      setIncomingCall(null);
      setCallStatus('Connected');
    } catch (error) {
      console.error('Error accepting call:', error);
      setCallStatus('Failed to accept call. Check camera/microphone permissions.');
      setIncomingCall(null);
      endVideoCall();
    }
  };

  const rejectCall = () => {
    socket.emit('call-rejected', { to: incomingCall.from });
    setIncomingCall(null);
    setCallStatus('Call rejected.');
    setIsCallEnded(true);
  };

  const endVideoCall = () => {
    setIsCallEnded(true);
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setIsVideoCallActive(false);
    setIncomingCall(null);
    setCallStatus('');
    candidatesRef.current = [];
    socket.emit('end-call', { to: remoteUserId });
  };

  const toggleMic = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMicOn((prev) => !prev);
    }
  };

  const toggleCamera = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsCameraOn((prev) => !prev);
    }
  };

  const toggleFullScreen = () => {
    const element = document.getElementById('video-call-container') || document.documentElement; // Use a specific container ID for better control
    if (!isFullScreen) {
      element.requestFullscreen().catch((err) => console.error('Full-screen error:', err));
    } else {
      document.exitFullscreen().catch((err) => console.error('Exit full-screen error:', err));
    }
    setIsFullScreen((prev) => !prev);
  };

  useEffect(() => {
    if (userId) {
      socket.on('incoming-call', ({ from, offer }) => {
        if (!isVideoCallActive && !isCallEnded) {
          setIncomingCall({ from, offer });
          setCallStatus('Incoming call...');
        } else {
          socket.emit('call-rejected', { to: from });
        }
      });

      socket.on('call-accepted', async ({ answer }) => {
        try {
          const pc = peerConnectionRef.current;
          if (pc && pc.signalingState !== 'closed') {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
            await processQueuedCandidates(); // Process any queued candidates after setting remote desc
            setCallStatus('Connected');
          } else {
            console.warn('Cannot set remote description: Peer connection is closed or null');
            setCallStatus('Call failed: Connection closed.');
            endVideoCall();
          }
        } catch (error) {
          console.error('Error handling call-accepted:', error);
          setCallStatus('Failed to connect call.');
          endVideoCall();
        }
      });

      socket.on('call-rejected', () => {
        setCallStatus('Call rejected by user.');
        endVideoCall();
      });

      socket.on('peer-negotiation-needed', ({ candidate }) => {
        console.log('Received ICE candidate:', candidate);
        if (!candidate) return;
        const pc = peerConnectionRef.current;
        if (pc && pc.remoteDescription && pc.signalingState !== 'closed') {
          pc.addIceCandidate(new RTCIceCandidate(candidate))
            .then(() => console.log('Added ICE candidate successfully'))
            .catch((error) => console.error('Error adding ICE candidate:', error));
        } else {
          candidatesRef.current.push(candidate);
          console.log('Queued ICE candidate:', candidate);
        }
      });

      socket.on('end-call', () => {
        setCallStatus('Call ended by remote user.');
        endVideoCall();
      });

      socket.on('user-offline', ({ userId: offlineUserId }) => {
        if (offlineUserId === remoteUserId) {
          setCallStatus('User is offline.');
          endVideoCall();
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
  }, [userId, remoteUserId]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  return {
    localVideoRef,
    remoteVideoRef,
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
  };
};

export default useWebRTC;