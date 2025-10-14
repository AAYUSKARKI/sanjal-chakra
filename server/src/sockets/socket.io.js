import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid'; // Add uuid for unique call IDs

let io;
const onlineUsers = new Map();
const activeCalls = new Set(); // Track active calls to prevent re-emission

const allowedOrigins = [
  'http://localhost:5173',
  'https://sanjal-chakra.vercel.app',
  'https://sanjal-chakra.vercel.app/',
];

export const setUpSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g., mobile apps or curl)
        if (!origin) return callback(null, true);
        // Check if the request origin is in the allowedOrigins list
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

    // Register user with socket
    socket.on('register', (userId) => {
      socket.userId = userId;
      onlineUsers.set(userId, socket.id);
      console.log(`User ${userId} registered with socket ${socket.id}`);
    });

    // WebRTC signaling events
    socket.on('user-call', ({ to, offer }) => {
      const receiverSocketId = onlineUsers.get(to);
      const callId = uuidv4(); // Generate unique call ID
      if (receiverSocketId) {
        console.log(
          `Emitting incoming-call to ${to} from ${socket.userId} with callId: ${callId}`
        );
        activeCalls.add(callId);
        io.to(receiverSocketId).emit('incoming-call', {
          from: socket.userId,
          offer,
          callId,
        });
      } else {
        console.log(`User ${to} is offline`);
        io.to(socket.id).emit('user-offline', { userId: to });
      }
    });

    socket.on('call-accepted', ({ to, answer, callId }) => {
      const receiverSocketId = onlineUsers.get(to);
      if (receiverSocketId) {
        console.log(`Emitting call-accepted to ${to} with callId: ${callId}`);
        io.to(receiverSocketId).emit('call-accepted', { answer, callId });
      }
    });

    socket.on('call-rejected', ({ to, callId }) => {
      const receiverSocketId = onlineUsers.get(to);
      if (receiverSocketId) {
        console.log(`Emitting call-rejected to ${to} with callId: ${callId}`);
        activeCalls.delete(callId);
        io.to(receiverSocketId).emit('call-rejected', { callId });
      }
    });

    socket.on('peer-negotiation-needed', ({ to, candidate, callId }) => {
      const receiverSocketId = onlineUsers.get(to);
      if (receiverSocketId) {
        console.log(
          `Emitting peer-negotiation-needed to ${to} with candidate and callId: ${callId}`
        );
        io.to(receiverSocketId).emit('peer-negotiation-needed', {
          candidate,
          callId,
        });
      }
    });

    socket.on('end-call', ({ to, callId }) => {
      if (!activeCalls.has(callId)) {
        console.log(`end-call ignored for callId: ${callId}, already processed`);
        return;
      }
      const receiverSocketId = onlineUsers.get(to);
      if (receiverSocketId) {
        console.log(`Emitting end-call to ${to} with callId: ${callId}`);
        activeCalls.delete(callId);
        io.to(receiverSocketId).emit('end-call', { callId });
      }
    });

    // Message events
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
      console.log(
        `Emitting receive-group-message to group ${groupId} by ${senderName}`
      );
      io.to(groupId).emit('receive-group-message', data);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`Disconnect: ${socket.id}`);
      for (let [userId, id] of onlineUsers.entries()) {
        if (id === socket.id) {
          onlineUsers.delete(userId);
          console.log(`Emitting user-offline for ${userId}`);
          io.emit('user-offline', { userId });
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
  } else {
    console.log(`User ${userId} is offline`);
  }
};
