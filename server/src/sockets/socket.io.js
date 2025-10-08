import { Server } from 'socket.io';

let io;
const onlineUsers = new Map();

export const setUpSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "http://localhost:5173",
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log(`User is connected: ${socket.id}`);

    // Register user with socket
    socket.on('register', (userId) => {
      socket.userId = userId; // Store userId on socket
      onlineUsers.set(userId, socket.id);
      console.log(`User ${userId} registered with socket ${socket.id}`);
    });

    // WebRTC signaling events
    socket.on('user-call', ({ to, offer }) => {
      const receiverSocketId = onlineUsers.get(to);
      if (receiverSocketId) {
        console.log(`Emitting incoming-call to ${to} from ${socket.userId}`);
        io.to(receiverSocketId).emit('incoming-call', { from: socket.userId, offer });
      } else {
        console.log(`User ${to} is offline`);
        io.to(socket.id).emit('user-offline', { userId: to });
      }
    });

    socket.on('call-accepted', ({ to, answer }) => {
      const receiverSocketId = onlineUsers.get(to);
      if (receiverSocketId) {
        console.log(`Emitting call-accepted to ${to}`);
        io.to(receiverSocketId).emit('call-accepted', { answer });
      }
    });

    socket.on('call-rejected', ({ to }) => {
      const receiverSocketId = onlineUsers.get(to);
      if (receiverSocketId) {
        console.log(`Emitting call-rejected to ${to}`);
        io.to(receiverSocketId).emit('call-rejected');
      }
    });

    socket.on('peer-negotiation-needed', ({ to, candidate }) => {
      const receiverSocketId = onlineUsers.get(to);
      if (receiverSocketId) {
        console.log(`Emitting peer-negotiation-needed to ${to} with candidate:`, candidate);
        io.to(receiverSocketId).emit('peer-negotiation-needed', { candidate });
      }
    });

    socket.on('end-call', ({ to }) => {
      const receiverSocketId = onlineUsers.get(to);
      if (receiverSocketId) {
        console.log(`Emitting end-call to ${to}`);
        io.to(receiverSocketId).emit('end-call');
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
      console.log(`Emitting receive-group-message to group ${groupId} by ${senderName}`);
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
  }
};