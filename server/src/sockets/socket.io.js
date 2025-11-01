import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

export let io;
const onlineUsers = new Map();
const activeCalls = new Set();

const allowedOrigins = [
  'http://localhost:5173',
  'https://sanjal-chakra.vercel.app',
  'https://sanjal-chakra.vercel.app/',
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

    socket.on('join-group', (groupId) => {
      socket.join(groupId);
      console.log(`Socket ${socket.id} joined group ${groupId}`);
    });

    //sent online users to client
    socket.on('get-online-users', () => {
      console.log(onlineUsers)
      const onlineUsersArray = Array.from(onlineUsers.keys());
      console.log(onlineUsersArray)
      socket.emit('online-users', onlineUsersArray);
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

    socket.on('user-call', ({ to, offer, groupId }) => {
      const callId = uuidv4();
      if (groupId) {
        console.log(`Emitting incoming-call to group ${groupId} from ${socket.userId} with callId: ${callId}`);
        activeCalls.add(callId);
        io.to(groupId).emit('incoming-call', {
          from: socket.userId,
          offer,
          callId,
          groupId,
        });
      } else {
        const receiverSocketId = onlineUsers.get(to);
        if (receiverSocketId) {
          console.log(`Emitting incoming-call to ${to} from ${socket.userId} with callId: ${callId}`);
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
      }
    });

    socket.on('call-accepted', ({ to, answer, callId, groupId }) => {
      if (groupId) {
        console.log(`Emitting call-accepted to ${to} for group ${groupId} with callId: ${callId}`);
        const receiverSocketId = onlineUsers.get(to);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('call-accepted', { answer, callId, from: socket.userId, groupId });
        }
      } else {
        const receiverSocketId = onlineUsers.get(to);
        if (receiverSocketId) {
          console.log(`Emitting call-accepted to ${to} with callId: ${callId}`);
          io.to(receiverSocketId).emit('call-accepted', { answer, callId, from: socket.userId });
        }
      }
    });

    socket.on('call-rejected', ({ to, callId, groupId }) => {
      if (groupId) {
        console.log(`Emitting call-rejected to ${to} for group ${groupId} with callId: ${callId}`);
        const receiverSocketId = onlineUsers.get(to);
        if (receiverSocketId) {
          activeCalls.delete(callId);
          io.to(receiverSocketId).emit('call-rejected', { callId });
        }
      } else {
        const receiverSocketId = onlineUsers.get(to);
        if (receiverSocketId) {
          console.log(`Emitting call-rejected to ${to} with callId: ${callId}`);
          activeCalls.delete(callId);
          io.to(receiverSocketId).emit('call-rejected', { callId });
        }
      }
    });

    socket.on('peer-negotiation-needed', ({ to, candidate, callId, groupId }) => {
      if (groupId) {
        console.log(`Emitting peer-negotiation-needed to ${to} for group ${groupId} with callId: ${callId}`);
        const receiverSocketId = onlineUsers.get(to);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('peer-negotiation-needed', {
            candidate,
            callId,
            from: socket.userId,
            groupId,
          });
        }
      } else {
        const receiverSocketId = onlineUsers.get(to);
        if (receiverSocketId) {
          console.log(`Emitting peer-negotiation-needed to ${to} with callId: ${callId}`);
          io.to(receiverSocketId).emit('peer-negotiation-needed', {
            candidate,
            callId,
            from: socket.userId,
          });
        }
      }
    });

    socket.on('end-call', ({ to, callId, groupId }) => {
      if (!activeCalls.has(callId)) {
        console.log(`end-call ignored for callId: ${callId}, already processed`);
        return;
      }
      if (groupId) {
        console.log(`Emitting end-call to group ${groupId} with callId: ${callId}`);
        activeCalls.delete(callId);
        io.to(groupId).emit('end-call', { callId });
      } else {
        const receiverSocketId = onlineUsers.get(to);
        if (receiverSocketId) {
          console.log(`Emitting end-call to ${to} with callId: ${callId}`);
          activeCalls.delete(callId);
          io.to(receiverSocketId).emit('end-call', { callId });
        }
      }
    });

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

export const emitToGroup = (groupId, event, payload) => {
  if (!io) return;
  console.log(`Emitting ${event} to group ${groupId}`);
  io.to(groupId).emit(event, payload);
};