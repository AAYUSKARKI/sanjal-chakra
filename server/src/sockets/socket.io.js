import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

let io;
const onlineUsers = new Map();
const activeCalls = new Map(); // Changed to Map to store callId -> { from, to }

const allowedOrigins = [
  'http://localhost:5173',
  'https://sanjal-chakra.vercel.app',
  'https://sanjal-chakra.vercel.app/'
];

export const setUpSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log(`User is connected: ${socket.id}`);

    socket.on('register', (userId) => {
      socket.userId = userId;
      onlineUsers.set(userId, socket.id);
      console.log(`User ${userId} registered with socket ${socket.id}`);
    });

    socket.on('user-call', ({ to, offer }) => {
      const receiverSocketId = onlineUsers.get(to);
      const callId = uuidv4();
      if (receiverSocketId) {
        console.log(`Emitting incoming-call to ${to} from ${socket.userId} with callId: ${callId}`);
        activeCalls.set(callId, { from: socket.userId, to });
        io.to(receiverSocketId).emit('incoming-call', { from: socket.userId, offer, callId });
      } else {
        console.log(`User ${to} is offline`);
        io.to(socket.id).emit('user-offline', { userId: to });
      }
    });

    socket.on('call-accepted', ({ to, answer, callId }) => {
      if (!activeCalls.has(callId)) {
        console.log(`Ignoring call-accepted for inactive callId: ${callId}`);
        return;
      }
      const receiverSocketId = onlineUsers.get(to);
      if (receiverSocketId) {
        console.log(`Emitting call-accepted to ${to} with callId: ${callId}`);
        io.to(receiverSocketId).emit('call-accepted', { answer, callId });
      }
    });

    socket.on('call-rejected', ({ to, callId }) => {
      if (!activeCalls.has(callId)) {
        console.log(`Ignoring call-rejected for inactive callId: ${callId}`);
        return;
      }
      const receiverSocketId = onlineUsers.get(to);
      if (receiverSocketId) {
        console.log(`Emitting call-rejected to ${to} with callId: ${callId}`);
        activeCalls.delete(callId);
        io.to(receiverSocketId).emit('call-rejected', { callId });
      }
    });

    socket.on('peer-negotiation-needed', ({ to, candidate, callId }) => {
      if (!activeCalls.has(callId)) {
        console.log(`Ignoring peer-negotiation-needed for inactive callId: ${callId}`);
        return;
      }
      const receiverSocketId = onlineUsers.get(to);
      if (receiverSocketId) {
        console.log(`Emitting peer-negotiation-needed to ${to} with candidate and callId: ${callId}`);
        io.to(receiverSocketId).emit('peer-negotiation-needed', { candidate, callId });
      }
    });

    socket.on('end-call', ({ to, callId }) => {
      if (!activeCalls.has(callId)) {
        console.log(`Ignoring end-call for inactive callId: ${callId}`);
        return;
      }
      const receiverSocketId = onlineUsers.get(to);
      if (receiverSocketId) {
        console.log(`Emitting end-call to ${to} with callId: ${callId}`);
        activeCalls.delete(callId);
        io.to(receiverSocketId).emit('end-call', { callId });
      }
    });

    socket.on('send-message', (data) => {
      const { receiverId, to, message, senderName } = data;
      const receiverSocketId = onlineUsers.get(to || receiverId);
      if (receiverSocketId) {
        console.log(`Emitting receive-message to ${to || receiverId}`);
        io.to(receiverSocketId).emit('receive-message', data);
      }
    });

    socket.on('join-group', (groupId) => {
      socket.join(groupId);
      console.log(`Socket ${socket.id} joined group ${groupId}`);
    });

    socket.on('leave-group', (groupId) => {
      socket.leave(groupId);
      console.log(`Socket ${socket.id} left group ${groupId}`);
    });

    socket.on('send-group-message', (data) => {
      const { groupId, message, senderId, senderName } = data;
      console.log(`Emitting receive-group-message to group ${groupId} by ${senderName}`);
      io.to(groupId).emit('receive-group-message', data);
    });

    socket.on('disconnect', () => {
      console.log(`Disconnect: ${socket.id}`);
      for (let [userId, id] of onlineUsers.entries()) {
        if (id === socket.id) {
          onlineUsers.delete(userId);
          console.log(`Emitting user-offline for ${userId}`);
          io.emit('user-offline', { userId });
          // End any active calls for this user
          for (let [callId, { from, to }] of activeCalls.entries()) {
            if (from === userId || to === userId) {
              console.log(`Ending call ${callId} due to user ${userId} disconnect`);
              activeCalls.delete(callId);
              const otherUserId = from === userId ? to : from;
              const otherSocketId = onlineUsers.get(otherUserId);
              if (otherSocketId) {
                io.to(otherSocketId).emit('end-call', { callId });
              }
            }
          }
          break;
        }
      }
      console.log(`User disconnected: ${socket.id}`);
    });
  });
};

export const emitToUser = (userId, event, payload) => {
  if (!io) return;
  const socketId = onlineUsers.get(userId.toString());
  if (socketId) {
    console.log(`Emitting ${event} to user ${userId}`);
    io.to(socketId).emit(event, payload);
  }
};