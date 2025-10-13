import { useEffect, useRef, useState } from 'react';
import { socket } from '../utils/socket';

const useWebRTC = (userId, remoteUserId) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const candidatesQueueRef = useRef([]); // Renamed for clarity
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

  // Helper to create peer connection with improved logging
  const createPeerConnection = () => {
    console.log('Creating new RTCPeerConnection');
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && !isCallEnded) {
        console.log('Generated ICE candidate:', event.candidate);
        socket.emit('ice-candidate', { // Renamed event for clarity
          to: remoteUserId,
          candidate: event.candidate.toJSON(),
        });
      } else if (!event.candidate) {
        console.log('ICE candidate gathering complete');
      }
    };

    pc.ontrack = (event) => {
      console.log('Received remote track:', event.track);
      const [stream] = event.streams;
      if (stream && stream.active) {
        console.log('Setting active remote stream');
        setRemoteStream(stream);
      } else {
        console.warn('Received inactive remote stream');
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log('ICE connection state changed:', state);
      if (state === 'failed' || state === 'disconnected') {
        setCallStatus('Connection issues detected. Attempting reconnect...');
        setTimeout(() => {
          if (pc.iceConnectionState !== 'connected' && pc.iceConnectionState !== 'completed') {
            console.log('Reconnect timeout: Ending call');
            endCall();
          }
        }, 5000);
      } else if (state === 'connected' || state === 'completed') {
        setCallStatus('Connected');
      }
    };

    pc.onsignalingstatechange = () => {
      const state = pc.signalingState;
      console.log('Signaling state changed:', state);
      if (state === 'closed') {
        console.log('Signaling closed: Ending call');
        endCall();
      }
    };

    return pc;
  };

  // Process queued ICE candidates with better error handling
  const processQueuedCandidates = async () => {
    const pc = peerConnectionRef.current;
    if (!pc) {
      console.warn('No peer connection to add candidates');
      return;
    }
    while (candidatesQueueRef.current.length > 0) {
      const candidate = candidatesQueueRef.current.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('Added queued ICE candidate:', candidate);
      } catch (error) {
        console.error('Failed to add queued ICE candidate:', error, candidate);
      }
    }
  };

  // Start video call with improved error handling and logging
  const startCall = async () => {
    if (isVideoCallActive || incomingCall) {
      console.warn('Call already active or incoming; skipping start');
      return;
    }
    try {
      setCallStatus('Initiating call...');
      setIsCallEnded(false);
      setCallInitiator(true);
      candidatesQueueRef.current = [];

      console.log('Requesting user media');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true,
      });
      console.log('Local stream acquired:', stream);
      setLocalStream(stream);

      setIsVideoCallActive(true);
      peerConnectionRef.current = createPeerConnection();

      stream.getTracks().forEach((track) => {
        console.log('Adding local track:', track.kind);
        peerConnectionRef.current.addTrack(track, stream);
      });

      console.log('Creating offer');
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
      console.log('Local description set:', offer);

      socket.emit('call-offer', { to: remoteUserId, offer }); // Renamed event
      setCallStatus('Waiting for answer...');
    } catch (error) {
      console.error('Error starting call:', error);
      setCallStatus('Failed to start call. Check permissions.');
      endCall();
    }
  };

  // Accept incoming call
  const acceptCall = async (callData) => {
    if (!callData || !callData.offer) {
      console.warn('Invalid incoming call data');
      return;
    }
    try {
      const { from, offer } = callData;
      setCallStatus('Accepting call...');
      setIsCallEnded(false);
      setCallInitiator(false);
      candidatesQueueRef.current = [];

      console.log('Requesting user media for answer');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true,
      });
      console.log('Local stream acquired:', stream);
      setLocalStream(stream);

      setIsVideoCallActive(true);
      peerConnectionRef.current = createPeerConnection();

      stream.getTracks().forEach((track) => {
        console.log('Adding local track:', track.kind);
        peerConnectionRef.current.addTrack(track, stream);
      });

      console.log('Setting remote description:', offer);
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
      await processQueuedCandidates();

      console.log('Creating answer');
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      console.log('Local description set:', answer);

      socket.emit('call-answer', { to: from, answer }); // Renamed event
      setIncomingCall(null);
      setCallStatus('Connected');
    } catch (error) {
      console.error('Error accepting call:', error);
      setCallStatus('Failed to accept call.');
      setIncomingCall(null);
      endCall();
    }
  };

  // Reject call
  const rejectCall = () => {
    if (incomingCall) {
      console.log('Rejecting incoming call from:', incomingCall.from);
      socket.emit('call-rejected', { to: incomingCall.from });
      setIncomingCall(null);
      setCallStatus('Call rejected.');
      setIsCallEnded(true);
      endCall();
    }
  };

  // End call with robust cleanup
  const endCall = () => {
    if (isCallEnded) {
      console.log('Call already ended; skipping');
      return;
    }
    console.log('Ending call');
    setIsCallEnded(true);
    setCallStatus('Call ended.');

    if (localStream) {
      localStream.getTracks().forEach((track) => {
        console.log('Stopping local track:', track.kind);
        track.stop();
      });
    }

    if (peerConnectionRef.current) {
      console.log('Closing peer connection');
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
    setIsVideoCallActive(false);
    setIncomingCall(null);
    setCallInitiator(false);
    candidatesQueueRef.current = [];

    // Emit end-call only if active or initiator
    if (isVideoCallActive || callInitiator) {
      console.log('Emitting end-call to:', remoteUserId);
      socket.emit('end-call', { to: remoteUserId });
    }
  };

  // Toggle mic
  const toggleMic = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
        console.log('Mic toggled:', track.enabled ? 'On' : 'Off');
      });
      setIsMicOn((prev) => !prev);
    } else {
      console.warn('No local stream to toggle mic');
    }
  };

  // Toggle camera
  const toggleCamera = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
        console.log('Camera toggled:', track.enabled ? 'On' : 'Off');
      });
      setIsCameraOn((prev) => !prev);
    } else {
      console.warn('No local stream to toggle camera');
    }
  };

  // Toggle full screen
  const toggleFullScreen = () => {
    const element = document.getElementById('video-call-container') || document.documentElement;
    if (!isFullScreen) {
      element.requestFullscreen().catch((err) => console.error('Fullscreen request failed:', err));
    } else {
      document.exitFullscreen().catch((err) => console.error('Exit fullscreen failed:', err));
    }
    setIsFullScreen((prev) => !prev);
    console.log('Fullscreen toggled:', !isFullScreen);
  };

  // Socket event listeners
  useEffect(() => {
    if (!userId) return;

    const handleIncomingCall = ({ from, offer }) => {
      if (!isVideoCallActive && !isCallEnded) {
        console.log('Received incoming call from:', from);
        setIncomingCall({ from, offer });
        setCallStatus('Incoming call...');
      } else {
        console.log('Auto-rejecting call: Already in call or ended');
        socket.emit('call-rejected', { to: from });
      }
    };

    const handleCallAnswer = async ({ answer }) => {
      const pc = peerConnectionRef.current;
      if (pc && pc.signalingState !== 'closed') {
        try {
          console.log('Setting remote description (answer):', answer);
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          await processQueuedCandidates();
          setCallStatus('Connected');
        } catch (error) {
          console.error('Error setting remote description:', error);
          setCallStatus('Connection failed.');
          endCall();
        }
      } else {
        console.warn('Peer connection invalid for answer');
        endCall();
      }
    };

    const handleCallRejected = () => {
      console.log('Call rejected by remote user');
      setCallStatus('Call rejected.');
      endCall();
    };

    const handleIceCandidate = ({ candidate }) => {
      if (!candidate) return;
      console.log('Received ICE candidate:', candidate);
      const pc = peerConnectionRef.current;
      if (pc && pc.remoteDescription && pc.signalingState !== 'closed') {
        pc.addIceCandidate(new RTCIceCandidate(candidate))
          .then(() => console.log('Added ICE candidate'))
          .catch((error) => console.error('Failed to add ICE candidate:', error));
      } else {
        console.log('Queuing ICE candidate');
        candidatesQueueRef.current.push(candidate);
      }
    };

    const handleEndCall = () => {
      console.log('Received end-call from remote');
      setCallStatus('Call ended by remote.');
      endCall();
    };

    const handleUserOffline = ({ userId: offlineUserId }) => {
      if (offlineUserId === remoteUserId) {
        console.log('Remote user offline');
        setCallStatus('User offline.');
        endCall();
      }
    };

    socket.on('call-offer', handleIncomingCall); // Updated event name
    socket.on('call-answer', handleCallAnswer); // Updated
    socket.on('call-rejected', handleCallRejected);
    socket.on('ice-candidate', handleIceCandidate); // Updated
    socket.on('end-call', handleEndCall);
    socket.on('user-offline', handleUserOffline);

    return () => {
      socket.off('call-offer', handleIncomingCall);
      socket.off('call-answer', handleCallAnswer);
      socket.off('call-rejected', handleCallRejected);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('end-call', handleEndCall);
      socket.off('user-offline', handleUserOffline);
    };
  }, [userId, remoteUserId, isVideoCallActive, isCallEnded]);

  // Assign streams to video refs reactively
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      console.log('Assigning local stream to video ref');
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      console.log('Assigning remote stream to video ref');
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('useWebRTC cleanup: Ending any active call');
      endCall();
    };
  }, []);

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