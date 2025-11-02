import { useEffect, useState, useRef } from 'react';
import { ImageIcon, SendHorizonal, Phone, Video, Mic, MicOff, VideoOff, Maximize2, Minimize2, X, RefreshCw, Info } from 'lucide-react';
import useAuth from '../hooks/useAuth';
import { useParams } from 'react-router-dom';
import API from '../api/api';
import { socket } from '../utils/socket';
import useWebRTC from '../hooks/useWebRTC';
import { motion, AnimatePresence } from 'framer-motion';
import { Search } from 'lucide-react';
import toast from 'react-hot-toast';
// Message List Component
const MessageList = ({ messages, user }) => {
  return (
    <div className="space-y-3 max-w-3xl mx-auto px-4">
      <AnimatePresence>
        {messages.map((message) => (
          <motion.div
            key={message._id}
            className={`flex ${
              message.sender._id === user._id ? 'justify-end' : 'justify-start'
            } items-end gap-2 my-2`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {/* Avatar on LEFT for others */}
            {message.sender._id !== user._id && (
              <img
                src={
                  message.sender.profilePics ||
                  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200'
                }
                alt={message.sender.fullname}
                className="w-8 h-8 rounded-full object-cover"
              />
            )}

            {/* Message Bubble */}
            <div
              className={`flex flex-col max-w-[70%] rounded-2xl p-3 shadow-md transition-all duration-200 hover:shadow-lg ${
                message.sender._id === user._id
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : 'bg-gray-100 text-gray-800 rounded-bl-none'
              }`}
            >
              {message.sender._id !== user._id && (
                <p className="text-xs font-medium text-gray-600 mb-1">
                  {message.sender.fullname}
                </p>
              )}
              {message.message_type === 'image' && message.media_url && (
                <img
                  src={message.media_url}
                  className="w-full max-w-[200px] rounded-lg mb-2 shadow-sm object-cover"
                  alt="Sent media"
                />
              )}
              {message.text && (
                <p className="text-sm break-words">{message.text}</p>
              )}
              <span className="text-xs text-gray-400 mt-1 self-end">
                {new Date(message.createdAt).toLocaleString('en-US', {
                  hour: 'numeric',
                  minute: 'numeric',
                  hour12: true,
                })}
              </span>
            </div>

            {/* Avatar on RIGHT for current user */}
            {message.sender._id === user._id && (
              <img
                src={
                  user.profilePics ||
                  'https://avatar.iran.liara.run/username?username=' + user.username
                }
                alt={user.fullname}
                className="w-8 h-8 rounded-full object-cover"
              />
            )}
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
      className={`p-5 flex flex-col md:flex-row flex-wrap gap-4 justify-center bg-gray-100 rounded-lg shadow-2xl ${
        isFullScreen ? 'fixed inset-0 z-50' : ''
      }`}
      initial={{ scale: 0.95 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.3 }}
      id="video-call-container"
    >
      <div className="relative">
        <h3 className="text-sm font-medium mb-2 text-gray-800">You</h3>
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="w-full max-w-[240px] rounded-lg shadow-lg border border-gray-200"
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
        .filter((member) => member._id !== localStream?.id)
        .map((member) => (
          <div key={member._id} className="relative">
            <h3 className="text-sm font-medium mb-2 text-gray-800">{member.fullname}</h3>
            <video
              ref={(el) => (remoteVideoRefs.current[member._id] = { current: el })}
              autoPlay
              playsInline
              className="w-full max-w-[240px] rounded-lg shadow-lg border border-gray-200"
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
    className="fixed inset-0 bg-gray-900/80 flex items-center justify-center z-50"
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
      <h2 className="text-xl font-bold text-gray-900">Incoming Group Call</h2>
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
// import { useEffect, useState } from 'react';
// import { motion } from 'framer-motion';
// import API from '../api/api';
// import { socket } from '../utils/socket';
// import { toast } from 'react-toastify'; // Assuming react-toastify for notifications

const GroupDetailsModal = ({ group, onClose, user, onLeaveGroup, onAddMember, onKickMember }) => {
  const [connections, setConnections] = useState([]);
  const [filteredConnections, setFilteredConnections] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');
  const isAdmin = group.admins.some((admin) => admin._id === user._id);

  // Fetch connections
  const getConnections = async () => {
    try {
      const { data } = await API.get(`/users/${user._id}/getconnections`, { withCredentials: true });
      // Filter out existing group members
      const filtered = data.filter((conn) => !group.members.some((m) => m._id === conn._id));
      setConnections(filtered);
      setFilteredConnections(filtered);
    } catch (error) {
      setError('Failed to load connections.');
      console.error(error);
    }
  };

  // Fetch connections when modal opens
  useEffect(() => {
    if (isAdmin) {
      getConnections();
    }
  }, [user._id, group.members]);

  // Handle search
  useEffect(() => {
    const filtered = connections.filter(
      (conn) =>
        conn.fullname.toLowerCase().includes(search.toLowerCase()) ||
        conn.username.toLowerCase().includes(search.toLowerCase())
    );
    setFilteredConnections(filtered);
  }, [search, connections]);

  // Toggle selection
  const handleToggle = (userId) => {
    setSelected((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  // Add selected members
  const handleAddMember = async () => {
    if (selected.length === 0) {
      setError('Please select at least one member.');
      return;
    }
    setIsAdding(true);
    try {
      await onAddMember(selected);
      setSelected([]);
      setSearch('');
      setError('');
      toast.success(`${selected.length} member(s) added successfully!`);
    } catch (err) {
      console.log(err)
      setError(err.message || 'Failed to add members.');
      toast.error(err.message || 'Failed to add members.');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 bg-gray-900/80 flex items-center justify-center z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="bg-white p-6 rounded-2xl shadow-2xl max-w-md w-full"
        initial={{ scale: 0.8, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">Group Details</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-all duration-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <img
              src={group.photo || 'https://res.cloudinary.com/dczqoleux/image/upload/v1760852684/group_photos/default_group.png'}
              alt={group.name}
              className="w-12 h-12 rounded-full border-2 border-blue-200"
            />
            <div>
              <p className="font-semibold text-lg text-gray-800">{group.name}</p>
              <p className="text-sm text-gray-500">{group.members.length} members</p>
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-600">{group.description || 'No description'}</p>
          </div>
          {isAdmin && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Add Members</h3>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search connections..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 w-full py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-blue-500"
                  disabled={isAdding}
                />
              </div>
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
                {filteredConnections.length === 0 && (
                  <p className="text-sm text-gray-500 text-center">No connections available.</p>
                )}
                {filteredConnections.map((user) => (
                  <div
                    key={user._id}
                    onClick={() => !isAdding && handleToggle(user._id)}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer ${
                      selected.includes(user._id)
                        ? 'bg-blue-100'
                        : 'hover:bg-gray-100'
                    } transition-all duration-200`}
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={
                          user.profilePics ||
                          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200'
                        }
                        alt={user.fullname}
                        className="w-10 h-10 rounded-full"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-700">{user.fullname}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={selected.includes(user._id)}
                      readOnly
                      className="accent-blue-500"
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={handleAddMember}
                className={`w-full mt-3 p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all duration-200 ${
                  isAdding || selected.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                disabled={isAdding || selected.length === 0}
              >
                {isAdding ? 'Adding...' : `Add ${selected.length} Member${selected.length > 1 ? 's' : ''}`}
              </button>
              {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
            </div>
          )}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Members</h3>
            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
              {group.members.map((member) => (
                <div
                  key={member._id}
                  className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-blue-50 transition-all duration-200"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={
                        member.profilePics ||
                        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200'
                      }
                      alt={member.fullname}
                      className="w-10 h-10 rounded-full"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-700">{member.fullname}</p>
                      <p className="text-xs text-gray-500">{member.email}</p>
                      {group.admins.some((admin) => admin._id === member._id) && (
                        <span className="text-xs text-blue-500">Admin</span>
                      )}
                    </div>
                  </div>
                  {isAdmin && member._id !== user._id && (
                    <button
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to remove ${member.fullname}?`)) {
                          onKickMember(member._id);
                        }
                      }}
                      className="text-red-500 text-xs hover:text-red-600"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to leave this group?')) {
                onLeaveGroup();
              }
            }}
            className="w-full p-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-all duration-200"
          >
            Leave Group
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Chat Input Component
const ChatInput = ({ text, setText, image, setImage, sendMessage, isSending }) => (
  <div className="px-4 py-3 bg-white border-t border-gray-200 shadow-sm">
    <div className="flex items-center gap-2 max-w-3xl mx-auto bg-gray-50 border border-gray-200 rounded-full p-2">
      <input
        type="text"
        className="flex-1 outline-none bg-transparent text-gray-800 text-sm px-3"
        placeholder="Type a message..."
        onKeyDown={(e) => e.key === 'Enter' && !isSending && sendMessage()}
        onChange={(e) => setText(e.target.value)}
        value={text}
        aria-label="Type a message"
        disabled={isSending}
      />
      <label htmlFor="image" className="cursor-pointer">
        {image ? (
          <img
            src={URL.createObjectURL(image)}
            alt="Preview"
            className="h-8 rounded-md"
          />
        ) : (
          <ImageIcon className="size-5 text-gray-500 hover:text-blue-500 transition-colors duration-200" />
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
        className={`p-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-all duration-200 ${
          isSending || (!text && !image) ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        aria-label="Send message"
        disabled={isSending || (!text && !image)}
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

  // Send group message
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
    // setMessages((prev) => [...prev, tempMessage]);
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

  // Leave group
  const leaveGroup = async () => {
    try {
      await API.post(`/group/groups/${groupId}/leave`, {}, { withCredentials: true });
      socket.emit('leave-group', groupId);
      // Redirect to another page (e.g., groups list) or clear group state
      window.location.href = '/groups'; // Adjust as needed
    } catch (error) {
      setError('Failed to leave group.');
      console.error(error);
    }
  };

  // Add member
// In GroupChat component
const addMember = async (userIds) => {
  try {
    const res = await API.post(
      `/group/groups/${groupId}/invite`,
      { userIds },
      { withCredentials: true }
    );
    setGroup(res.data.group);
    console.log(res.data.group);
    userIds.forEach((userId) => {
      socket.emit('group-updated', {
        groupId,
        action: 'add',
        member: res.data.group.members.find((m) => m._id === userId),
      });
    });
  } catch (error) {
    console.log(error)
    throw new Error(error.response?.data?.message || 'Failed to add members');
  }
};

  // Kick member
  const kickMember = async (memberId) => {
    try {
      const res = await API.patch(
        `/group/groups/${groupId}/remove-member`,
        { memberId },
        { withCredentials: true }
      );
      setGroup(res.data.group);
      socket.emit('group-updated', { groupId, action: 'remove', memberId });
    } catch (error) {
      setError('Failed to remove member.');
      console.error(error);
    }
  };

  // Socket.IO handling
  useEffect(() => {
    if (user && groupId) {
      socket.connect();
      socket.emit('register', user._id);
      socket.emit('join-group', groupId);
      socket.on('receive-message', (message) => {
        console.log(message)
        if (message.group === groupId) {
          setMessages((prev) => [...prev, message].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
        }
        }
      );
      socket.on('group-updated', ({ groupId: updatedGroupId, action, member, memberId }) => {
        if (updatedGroupId === groupId) {
          fetchGroup(); // Refresh group data
          if (action === 'remove' && memberId === user._id) {
            window.location.href = '/groups'; // Redirect if user is kicked
          }
        }
      });
      return () => {
        socket.off('receive-group-message');
        socket.off('group-updated');
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
      <div className="flex justify-center items-center h-screen bg-gray-50">
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
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <motion.div
        className="flex items-center justify-between p-4 bg-white border-b border-gray-200 shadow-sm"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-3">
          <img
            src={group.photo || 'https://res.cloudinary.com/dczqoleux/image/upload/v1760852684/group_photos/default_group.png'}
            alt={group.name}
            className="w-10 h-10 rounded-full border border-gray-200"
          />
          <div>
            <p className="font-semibold text-lg text-gray-800">{group.name}</p>
            <p className="text-xs text-gray-500">{group.members.length} members</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => console.log('Group audio call started')}
            className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all duration-200"
            aria-label="Start group audio call"
          >
            <Phone size={18} />
          </button>
          <button
            onClick={isVideoCallActive ? endVideoCall : startVideoCall}
            className={`p-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-all duration-200 ${
              incomingCall ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            aria-label={isVideoCallActive ? 'End group video call' : 'Start group video call'}
            disabled={incomingCall}
          >
            <Video size={18} />
          </button>
          <button
            onClick={() => setShowGroupDetails(true)}
            className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all duration-200"
            aria-label="View group details"
          >
            <Info size={18} />
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
          <GroupDetailsModal
            group={group}
            onClose={() => setShowGroupDetails(false)}
            user={user}
            onLeaveGroup={leaveGroup}
            onAddMember={addMember}
            onKickMember={kickMember}
          />
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
      <div className="flex-1 p-5 overflow-y-auto bg-gray-50" role="log" aria-live="polite">
        <MessageList messages={messages} user={user} />
        <div ref={messageEndRef} />
      </div>

      {/* Chat Input */}
      <ChatInput text={text} setText={setText} image={image} setImage={setImage} sendMessage={sendMessage} isSending={isSending} />
    </div>
  );
};

export default GroupChat;