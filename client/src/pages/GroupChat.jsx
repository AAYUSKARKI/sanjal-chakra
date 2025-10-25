import { useEffect, useState, useRef } from 'react';
import { ImageIcon, SendHorizonal, Phone, Video, Mic, MicOff, VideoOff, Maximize2, Minimize2, X, RefreshCw, Users, Info } from 'lucide-react';
import useAuth from '../hooks/useAuth';
import { useParams } from 'react-router-dom';
import API from '../api/api';
import { socket } from '../utils/socket';
import useWebRTC from '../hooks/useWebRTC';
import { motion, AnimatePresence } from 'framer-motion';

// Message List Component
const MessageList = ({ messages, user }) => {
  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <AnimatePresence>
        {messages.map((message, index) => (
          <motion.div
            key={message._id || index}
            className={`flex flex-col ${message.sender._id === user._id ? 'items-end' : 'items-start'}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div
              className={`p-4 text-sm max-w-md rounded-2xl shadow-lg ${
                message.sender._id === user._id
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-br-none'
                  : 'bg-gradient-to-r from-indigo-100 to-purple-100 text-slate-800 rounded-bl-none'
              } transition-all duration-200 hover:shadow-xl`}
            >
              {message.sender._id !== user._id && (
                <p className="text-xs font-medium text-gray-600 mb-1">{message.sender.fullname}</p>
              )}
              {message.message_type === 'image' && (
                <img
                  src={message.media_url}
                  className="w-full max-w-xs rounded-lg mb-2 shadow"
                  alt="Message media"
                />
              )}
              <p>{message.text}</p>
              <span className="text-xs text-gray-400 mt-2 block">
                {new Date(message.createdAt).toLocaleString('en-US', {
                  hour: 'numeric',
                  minute: 'numeric',
                  hour12: true,
                })}
              </span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

// Video Call UI Component
const VideoCallUI = ({
  localVideoRef,
  remoteVideoRefs,
  endVideoCall,
  toggleMic,
  toggleCamera,
  isMicOn,
  isCameraOn,
  toggleFullScreen,
  isFullScreen,
  localStream,
  remoteStreams,
  groupMembers,
}) => {
  return (
    <motion.div
      className={`p-5 flex flex-col md:flex-row gap-4 justify-center bg-gradient-to-b from-gray-100 to-gray-200 rounded-lg shadow-2xl ${
        isFullScreen ? 'fixed inset-0 z-50' : ''
      }`}
      initial={{ scale: 0.95 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.3 }}
      id="video-call-container"
    >
      <div className="relative">
        <h3 className="text-sm font-medium mb-2 text-slate-800">You</h3>
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="w-full md:w-64 rounded-lg shadow-lg border border-gray-200"
        />
        {!localStream && (
          <div className="absolute inset-0 bg-gray-800 flex items-center justify-center rounded-lg">
            <span className="text-white">No local video</span>
          </div>
        )}
        {localStream && localStream.getVideoTracks().length === 0 && (
          <div className="absolute inset-0 bg-gray-800 flex items-center justify-center rounded-lg">
            <VideoOff className="text-white" size={32} />
          </div>
        )}
      </div>
      {groupMembers
        .filter(member => member._id !== userId)
        .map(member => (
          <div key={member._id} className="relative">
            <h3 className="text-sm font-medium mb-2 text-slate-800">{member.fullname}</h3>
            <video
              ref={el => (remoteVideoRefs.current[member._id] = { current: el })}
              autoPlay
              playsInline
              className="w-full md:w-64 rounded-lg shadow-lg border border-gray-200"
            />
            {!remoteStreams[member._id] && (
              <div className="absolute inset-0 bg-gray-800 flex items-center justify-center rounded-lg">
                <span className="text-white">{`Waiting for ${member.fullname}'s video...`}</span>
              </div>
            )}
            {remoteStreams[member._id] && remoteStreams[member._id].getVideoTracks().length === 0 && (
              <div className="absolute inset-0 bg-gray-800 flex items-center justify-center rounded-lg">
                <span className="text-white">{`${member.fullname}'s video is off`}</span>
              </div>
            )}
          </div>
        ))}
      <div className="flex gap-3 mt-4 justify-center">
        <button
          onClick={toggleMic}
          className={`p-3 rounded-full ${isMicOn ? 'bg-green-500' : 'bg-red-500'} text-white hover:opacity-90 transition-all duration-200 shadow`}
          aria-label={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
        >
          {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
        </button>
        <button
          onClick={toggleCamera}
          className={`p-3 rounded-full ${isCameraOn ? 'bg-green-500' : 'bg-red-500'} text-white hover:opacity-90 transition-all duration-200 shadow`}
          aria-label={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
        >
          {isCameraOn ? <Video size={20} /> : <VideoOff size={20} />}
        </button>
        <button
          onClick={toggleFullScreen}
          className="p-3 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-all duration-200 shadow"
          aria-label={isFullScreen ? 'Exit full screen' : 'Enter full screen'}
        >
          {isFullScreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
        </button>
        <button
          onClick={endVideoCall}
          className="p-3 rounded-full bg-red-500 text-white hover:bg-red-600 transition-all duration-200 shadow"
          aria-label="End call"
        >
          <X size={20} />
        </button>
      </div>
    </motion.div>
  );
};

// Incoming Call Modal Component
const IncomingCallModal = ({ caller, onAccept, onReject, callId }) => (
  <motion.div
    className="fixed inset-0 bg-gradient-to-br from-gray-900/80 to-blue-900/80 flex items-center justify-center z-50"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.3 }}
  >
    <motion.div
      className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-6 max-w-md w-full"
      initial={{ scale: 0.8, y: 50 }}
      animate={{ scale: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <h2 className="text-xl font-bold text-slate-900">Incoming Group Call</h2>
      <p className="text-gray-600 text-sm">From: {caller?.name || 'Group'}</p>
      <div className="flex gap-4">
        <button
          onClick={() => onAccept()}
          className="p-3 rounded-full bg-green-500 text-white hover:bg-green-600 transition-all duration-200 shadow"
          aria-label="Accept group call"
        >
          <Video size={24} />
        </button>
        <button
          onClick={() => onReject(callId)}
          className="p-3 rounded-full bg-red-500 text-white hover:bg-red-600 transition-all duration-200 shadow"
          aria-label="Reject group call"
        >
          <X size={24} />
        </button>
      </div>
    </motion.div>
  </motion.div>
);

// Group Details Modal Component
const GroupDetailsModal = ({ group, onClose, user }) => (
  <motion.div
    className="fixed inset-0 bg-gradient-to-br from-gray-900/80 to-blue-900/80 flex items-center justify-center z-50"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.3 }}
  >
    <motion.div
      className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full"
      initial={{ scale: 0.8, y: 50 }}
      animate={{ scale: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-900">Group Details</h2>
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-gray-100 text-slate-600 transition-all duration-200"
        >
          <X className="w-6 h-6" />
        </button>
      </div>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <img
            src={group.photo || 'https://res.cloudinary.com/dczqoleux/image/upload/v1760852684/group_photos/default_group.png'}
            alt={group.name}
            className="size-16 rounded-full border-2 border-blue-200"
          />
          <div>
            <p className="font-semibold text-lg text-slate-800">{group.name}</p>
            <p className="text-sm text-gray-500">{group.members.length} members</p>
          </div>
        </div>
        <div>
          <p className="text-sm text-gray-600">{group.description || 'No description'}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-slate-700 mb-2">Members</h3>
          <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
            {group.members.map((member) => (
              <div
                key={member._id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-blue-50 transition-all duration-200"
              >
                <img
                  src={member.profilePics || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200'}
                  alt={member.fullname}
                  className="size-10 rounded-full"
                />
                <div>
                  <p className="text-sm font-medium text-slate-700">{member.fullname}</p>
                  <p className="text-xs text-gray-500">{member.email}</p>
                  {group.admins.some(admin => admin._id === member._id) && (
                    <span className="text-xs text-blue-500">Admin</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  </motion.div>
);

// Chat Input Component
const ChatInput = ({ text, setText, image, setImage, sendMessage, isSending }) => (
  <div className="px-4 mb-5">
    <div className="flex items-center gap-3 p-3 bg-white w-full max-w-xl mx-auto border border-gray-200 shadow-lg rounded-full">
      <input
        type="text"
        className="flex-1 outline-none text-slate-700 text-sm"
        placeholder="Type a message..."
        onKeyDown={(e) => e.key === 'Enter' && !isSending && sendMessage()}
        onChange={(e) => setText(e.target.value)}
        value={text}
        aria-label="Type a message"
        disabled={isSending}
      />
      <label htmlFor="image" className="cursor-pointer">
        {image ? (
          <img src={URL.createObjectURL(image)} alt="Preview" className="h-10 rounded-lg shadow" />
        ) : (
          <ImageIcon className="size-6 text-gray-400 hover:text-blue-500 transition-all duration-200" />
        )}
        <input
          type="file"
          id="image"
          accept="image/*"
          hidden
          onChange={(e) => setImage(e.target.files[0])}
          disabled={isSending}
        />
      </label>
      <button
        onClick={sendMessage}
        className={`p-2 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700 active:scale-95 transition-all duration-200 ${
          isSending ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        aria-label="Send message"
        disabled={isSending}
      >
        {isSending ? (
          <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8h8a8 8 0 01-8 8v-8H4z" />
          </svg>
        ) : (
          <SendHorizonal size={18} />
        )}
      </button>
    </div>
  </div>
);

const GroupChat = () => {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [image, setImage] = useState(null);
  const [group, setGroup] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [showGroupDetails, setShowGroupDetails] = useState(false);
  const { user } = useAuth();
  const { groupId } = useParams();
  const messageEndRef = useRef(null);

  // WebRTC hook for group call
  const {
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
  } = useWebRTC(user?._id, groupId, true, group?.members || []);

  // Fetch group data
  const fetchGroup = async () => {
    try {
      setIsLoading(true);
      const res = await API.get(`/group/groups/groupbyid/${groupId}`, { withCredentials: true });
      setGroup(res.data.group);
    } catch (error) {
      setError('Failed to load group data.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch group messages
  const fetchMessages = async () => {
    try {
      setIsLoading(true);
      const res = await API.get(`/group/groups/${groupId}/messages`, { withCredentials: true });
      setMessages(res.data.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
    } catch (error) {
      setError('Failed to load group messages.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Send group message with optimistic update
  const sendMessage = async () => {
    if (!text && !image) return;
    setIsSending(true);
    const tempMessage = {
      _id: Date.now(),
      sender: { _id: user._id, fullname: user.fullname },
      group: groupId,
      text,
      message_type: image ? 'image' : 'text',
      media_url: image ? URL.createObjectURL(image) : null,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMessage]);
    setText('');
    setImage(null);

    const formData = new FormData();
    formData.append('sender', user._id);
    formData.append('text', text);
    formData.append('message_type', image ? 'image' : 'text');
    if (image) {
      formData.append('image', image);
    }

    try {
      const res = await API.post(`/group/groups/${groupId}/messages`, formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMessages((prev) => prev.map((msg) => (msg._id === tempMessage._id ? res.data : msg)));
    } catch (error) {
      setError('Failed to send group message.');
      setMessages((prev) => prev.filter((msg) => msg._id !== tempMessage._id));
      console.error(error);
    } finally {
      setIsSending(false);
    }
  };

  // Socket.IO group message handling
  useEffect(() => {
    if (user && groupId) {
      socket.connect();
      socket.emit('join-group', groupId);
      socket.on('receive-group-message', (message) => {
        if (message.group === groupId) {
          setMessages((prev) => [...prev, message].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
        }
      });
      return () => {
        socket.off('receive-group-message');
        socket.emit('leave-group', groupId);
        socket.disconnect();
      };
    }
  }, [user, groupId]);

  // Scroll to latest message
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch initial data
  useEffect(() => {
    fetchGroup();
    fetchMessages();
  }, [groupId]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gradient-to-b from-gray-50 to-gray-100">
        <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8h8a8 8 0 01-8 8v-8H4z" />
        </svg>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 text-center p-5 bg-gray-50 h-screen">{error}</div>;
  }

  if (!group) {
    return <div className="text-gray-500 text-center p-5 bg-gray-50 h-screen">Group not found.</div>;
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Header */}
      <motion.div
        className="flex items-center justify-between p-4 md:px-10 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200 shadow-sm"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-3">
          <img
            src={group.photo || 'https://res.cloudinary.com/dczqoleux/image/upload/v1760852684/group_photos/default_group.png'}
            alt={group.name}
            className="size-12 rounded-full border-2 border-blue-200 shadow"
          />
          <div>
            <p className="font-semibold text-xl text-slate-800">{group.name}</p>
            <p className="text-sm text-gray-500">{group.members.length} members • {group.description || 'No description'}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => console.log('Group audio call started')}
            className="p-2 rounded-full bg-green-500 text-white hover:bg-green-600 transition-all duration-200 shadow"
            aria-label="Start group audio call"
          >
            <Phone size={20} />
          </button>
          <button
            onClick={isVideoCallActive ? endVideoCall : startVideoCall}
            className={`p-2 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-all duration-200 shadow ${
              incomingCall ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            aria-label={isVideoCallActive ? 'End group video call' : 'Start group video call'}
            disabled={incomingCall}
          >
            <Video size={20} />
          </button>
          <button
            onClick={() => setShowGroupDetails(true)}
            className="p-2 rounded-full bg-gray-100 text-slate-600 hover:bg-gray-200 transition-all duration-200 shadow"
            aria-label="View group details"
          >
            <Info size={20} />
          </button>
        </div>
      </motion.div>

      {/* Call Status */}
      <AnimatePresence>
        {callStatus && (
          <motion.div
            className="p-3 text-center text-sm text-gray-600 bg-gray-100 shadow-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {callStatus}
            {callStatus.includes('Failed') && (
              <button
                onClick={startVideoCall}
                className="ml-2 p-1 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-all duration-200"
                aria-label="Retry group call"
              >
                <RefreshCw size={16} />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Incoming Call Modal */}
      <AnimatePresence>
        {incomingCall && (
          <IncomingCallModal
            caller={group}
            onAccept={() => acceptCall(incomingCall)}
            onReject={() => rejectCall(incomingCall.callId)}
            callId={incomingCall.callId}
          />
        )}
      </AnimatePresence>

      {/* Group Details Modal */}
      <AnimatePresence>
        {showGroupDetails && (
          <GroupDetailsModal group={group} onClose={() => setShowGroupDetails(false)} user={user} />
        )}
      </AnimatePresence>

      {/* Video Call UI */}
      {isVideoCallActive && (
        <VideoCallUI
          localVideoRef={localVideoRef}
          remoteVideoRefs={remoteVideoRefs}
          endVideoCall={endVideoCall}
          toggleMic={toggleMic}
          toggleCamera={toggleCamera}
          isMicOn={isMicOn}
          isCameraOn={isCameraOn}
          toggleFullScreen={toggleFullScreen}
          isFullScreen={isFullScreen}
          localStream={localStream}
          remoteStreams={remoteStreams}
          groupMembers={group.members}
        />
      )}

      {/* Messages */}
      <div className="flex-1 p-5 md:px-10 overflow-y-auto bg-gray-50">
        <MessageList messages={messages} user={user} />
        <div ref={messageEndRef} />
      </div>

      {/* Chat Input */}
      <ChatInput text={text} setText={setText} image={image} setImage={setImage} sendMessage={sendMessage} isSending={isSending} />
    </div>
  );
};

export default GroupChat;