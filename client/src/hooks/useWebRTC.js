import { useEffect, useRef, useState } from 'react';
import { socket } from '../utils/socket';

const useWebRTC = (userId, remoteUserId) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const candidatesQueueRef = useRef([]);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isVideoCallActive, setIsVideoCallActive] = useState(false);
  const [callStatus, setCallStatus] = useState('');
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [isCallEnded, setIsCallEnded] = useState(false);
  const [callInitiator, setCallInitiator] = useState(false);
  const [currentCallId, setCurrentCallId] = useState(null);
  const isCleaningUp = useRef(false); // New: Prevent redundant cleanup

  const createPeerConnection = () => {
    console.log('Creating RTCPeerConnection for user:', userId);
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && !isCallEnded && currentCallId) {
        console.log('Sending ICE candidate for call:', currentCallId);
        socket.emit('peer-negotiation-needed', {
          to: remoteUserId,
          candidate: event.candidate.toJSON(),
          callId: currentCallId,
        });
      } else if (!event.candidate) {
        console.log('ICE candidate gathering complete for call:', currentCallId);
      } else {
        console.warn('Skipping ICE candidate due to call ended or missing callId');
      }
    };

    pc.ontrack = (event) => {
      console.log('Received remote track:', event.track);
      const [stream] = event.streams;
      if (stream && stream.active && currentCallId) {
        console.log('Setting active remote stream for call:', currentCallId);
        setRemoteStream(stream);
      } else {
        console.warn('Received inactive remote stream or missing callId:', currentCallId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log('ICE connection state:', state, 'for call:', currentCallId);
      if (state === 'failed' || state === 'disconnected') {
        setCallStatus('Connection issues detected. Attempting reconnect...');
        setTimeout(() => {
          if (pc.iceConnectionState !== 'connected' && pc.iceConnectionState !== 'completed') {
            console.log('Reconnect timeout: Ending call:', currentCallId);
            endCall();
          }
        }, 5000);
      } else if (state === 'connected' || state === 'completed') {
        setCallStatus('Connected');
      }
    };

    pc.onsignalingstatechange = () => {
      const state = pc.signalingState;
      console.log('Signaling state:', state, 'for call:', currentCallId);
      if (state === 'closed' && !isCleaningUp.current) {
        console.log('Signaling closed: Ending call:', currentCallId);
        endCall();
      }
    };

    return pc;
  };

  const processQueuedCandidates = async () => {
    const pc = peerConnectionRef.current;
    if (!pc || !currentCallId || isCallEnded) {
      console.warn('No peer connection or call ended; skipping candidate processing for call:', currentCallId);
      candidatesQueueRef.current = []; // Clear queue
      return;
    }
    while (candidatesQueueRef.current.length > 0) {
      const candidate = candidatesQueueRef.current.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('Added queued ICE candidate:', candidate, 'for call:', currentCallId);
      } catch (error) {
        console.error('Failed to add ICE candidate:', error, 'for call:', currentCallId);
      }
    }
  };

  const startCall = async () => {
    if (isVideoCallActive || incomingCall || !userId || !remoteUserId) {
      console.warn('Cannot start call: active call, incoming call, or missing IDs', { isVideoCallActive, incomingCall, userId, remoteUserId });
      return;
    }
    try {
      setCallStatus('Initiating call...');
      setIsCallEnded(false);
      setCallInitiator(true);
      const newCallId = crypto.randomUUID();
      setCurrentCallId(newCallId);
      candidatesQueueRef.current = [];

      console.log('Requesting user media for call:', newCallId);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true,
      });
      console.log('Local stream acquired:', stream, 'for call:', newCallId);
      setLocalStream(stream);

      setIsVideoCallActive(true);
      peerConnectionRef.current = createPeerConnection();

      stream.getTracks().forEach((track) => {
        console.log('Adding local track:', track.kind, 'for call:', newCallId);
        peerConnectionRef.current.addTrack(track, stream);
      });

      console.log('Creating offer for call:', newCallId);
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
      console.log('Local description set:', offer, 'for call:', newCallId);

      socket.emit('user-call', { to: remoteUserId, offer, callId: newCallId });
      setCallStatus('Waiting for answer...');
    } catch (error) {
      console.error('Error starting call:', error, 'for user:', userId);
      setCallStatus('Failed to start call. Check permissions.');
      endCall();
    }
  };

  const acceptCall = async (callData) => {
    if (!callData || !callData.offer || !callData.callId || !callData.from) {
      console.warn('Invalid incoming call data:', callData);
      return;
    }
    try {
      const { from, offer, callId } = callData;
      setCallStatus('Accepting call...');
      setIsCallEnded(false);
      setCallInitiator(false);
      setCurrentCallId(callId);
      candidatesQueueRef.current = [];

      console.log('Requesting user media for call:', callId);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true,
      });
      console.log('Local stream acquired:', stream, 'for call:', callId);
      setLocalStream(stream);

      setIsVideoCallActive(true);
      peerConnectionRef.current = createPeerConnection();

      stream.getTracks().forEach((track) => {
        console.log('Adding local track:', track.kind, 'for call:', callId);
        peerConnectionRef.current.addTrack(track, stream);
      });

      console.log('Setting remote description for call:', callId);
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
      await processQueuedCandidates();

      console.log('Creating answer for call:', callId);
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      console.log('Local description set:', answer, 'for call:', callId);

      socket.emit('call-accepted', { to: from, answer, callId });
      setIncomingCall(null);
      setCallStatus('Connected');
    } catch (error) {
      console.error('Error accepting call:', error, 'for call:', callData.callId);
      setCallStatus('Failed to accept call.');
      setIncomingCall(null);
      endCall();
    }
  };

  const rejectCall = (callData) => {
    if (!callData || !callData.callId || !callData.from) {
      console.warn('Invalid incoming call data for rejection:', callData);
      return;
    }
    socket.emit('call-rejected', { to: callData.from, callId: callData.callId });
  };

  const endCall = () => {
    if (isCallEnded || isCleaningUp.current) {
      console.log('Call already ended or cleaning up:', currentCallId);
      return;
    }
    isCleaningUp.current = true;
    console.log('Ending call:', currentCallId);
    setIsCallEnded(true);
    setCallStatus('Call ended.');

    if (localStream) {
      localStream.getTracks().forEach((track) => {
        console.log('Stopping local track:', track.kind, 'for call:', currentCallId);
        track.stop();
      });
    }

    if (peerConnectionRef.current) {
      console.log('Closing peer connection for call:', currentCallId);
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
    setIsVideoCallActive(false);
    setIncomingCall(null);
    setCallInitiator(false);
    candidatesQueueRef.current = [];

    if (currentCallId && (isVideoCallActive || callInitiator)) {
      console.log('Emitting end-call to:', remoteUserId, 'for call:', currentCallId);
      socket.emit('end-call', { to: remoteUserId, callId: currentCallId });
    }

    setCurrentCallId(null);
    isCleaningUp.current = false;
  };

  // Toggle methods remain unchanged
  const toggleMic = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
        console.log('Mic toggled:', track.enabled ? 'On' : 'Off', 'for call:', currentCallId);
      });
      setIsMicOn((prev) => !prev);
    } else {
      console.warn('No local stream to toggle mic for call:', currentCallId);
    }
  };

  const toggleCamera = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
        console.log('Camera toggled:', track.enabled ? 'On' : 'Off', 'for call:', currentCallId);
      });
      setIsCameraOn((prev) => !prev);
    } else {
      console.warn('No local stream to toggle camera for call:', currentCallId);
    }
  };

  const toggleFullScreen = () => {
    const element = document.getElementById('video-call-container') || document.documentElement;
    if (!isFullScreen) {
      element.requestFullscreen().catch((err) => console.error('Fullscreen request failed:', err));
    } else {
      document.exitFullscreen().catch((err) => console.error('Exit fullscreen failed:', err));
    }
    setIsFullScreen((prev) => !prev);
    console.log('Fullscreen toggled:', !isFullScreen, 'for call:', currentCallId);
  };

  // Socket event listeners
  useEffect(() => {
    if (!userId || !remoteUserId) {
      console.warn('Missing userId or remoteUserId; skipping socket setup');
      return;
    }

    const handleIncomingCall = ({ from, offer, callId }) => {
      if (!isVideoCallActive && !isCallEnded && callId) {
        console.log('Received incoming call from:', from, 'callId:', callId);
        setIncomingCall({ from, offer, callId });
        setCallStatus('Incoming call...');
      } else {
        console.log('Auto-rejecting call from:', from, 'callId:', callId);
        socket.emit('call-rejected', { to: from, callId });
      }
    };

    const handleCallAccepted = async ({ answer, callId }) => {
      if (callId !== currentCallId || !currentCallId) {
        console.warn('Ignoring call-accepted for mismatched or null callId:', callId);
        return;
      }
      const pc = peerConnectionRef.current;
      if (pc && pc.signalingState !== 'closed') {
        try {
          console.log('Setting remote description (answer) for call:', callId);
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          await processQueuedCandidates();
          setCallStatus('Connected');
        } catch (error) {
          console.error('Error setting remote description for call:', callId, error);
          setCallStatus('Connection failed.');
          endCall();
        }
      } else {
        console.warn('Invalid peer connection for call:', callId);
        endCall();
      }
    };

    const handleCallRejected = ({ callId }) => {
      if (callId === currentCallId && currentCallId) {
        console.log('Call rejected by remote user:', callId);
        setCallStatus('Call rejected.');
        endCall();
      }
    };

    const handlePeerNegotiation = ({ candidate, callId }) => {
      if (!candidate || callId !== currentCallId || !currentCallId || isCallEnded) {
        console.log('Ignoring invalid or mismatched candidate for call:', callId);
        return;
      }
      console.log('Received ICE candidate for call:', callId);
      const pc = peerConnectionRef.current;
      if (pc && pc.remoteDescription && pc.signalingState !== 'closed') {
        pc.addIceCandidate(new RTCIceCandidate(candidate))
          .then(() => console.log('Added ICE candidate for call:', callId))
          .catch((error) => console.error('Failed to add ICE candidate for call:', callId, error));
      } else {
        console.log('Queuing ICE candidate for call:', callId);
        candidatesQueueRef.current.push(candidate);
      }
    };

    const handleEndCall = ({ callId }) => {
      if (callId === currentCallId && currentCallId) {
        console.log('Received end-call from remote for call:', callId);
        setCallStatus('Call ended by remote.');
        endCall();
      }
    };

    const handleUserOffline = ({ userId: offlineUserId }) => {
      if (offlineUserId === remoteUserId && currentCallId) {
        console.log('Remote user offline:', offlineUserId);
        setCallStatus('User offline.');
        endCall();
      }
    };

    socket.on('user-call', handleIncomingCall);
    socket.on('call-accepted', handleCallAccepted);
    socket.on('call-rejected', handleCallRejected);
    socket.on('peer-negotiation-needed', handlePeerNegotiation);
    socket.on('end-call', handleEndCall);
    socket.on('user-offline', handleUserOffline);

    return () => {
      socket.off('user-call', handleIncomingCall);
      socket.off('call-accepted', handleCallAccepted);
      socket.off('call-rejected', handleCallRejected);
      socket.off('peer-negotiation-needed', handlePeerNegotiation);
      socket.off('end-call', handleEndCall);
      socket.off('user-offline', handleUserOffline);
      console.log('Cleaned up socket listeners for user:', userId);
    };
  }, [userId, remoteUserId, isVideoCallActive, isCallEnded, currentCallId]);

  // Stream assignments remain unchanged
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      console.log('Assigning local stream to video ref for call:', currentCallId);
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, currentCallId]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      console.log('Assigning remote stream to video ref for call:', currentCallId);
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, currentCallId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (!isCleaningUp.current) {
        console.log('useWebRTC cleanup: Ending call:', currentCallId);
        endCall();
      }
    };
  }, [currentCallId]);

  return {
    localVideoRef,
    remoteVideoRef,
    startVideoCall: startCall,
    endVideoCall: endCall,
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
    remoteStream,
  };
};

export default useWebRTC;