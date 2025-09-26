import { on } from 'events';
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

    // user connection is made 
    io.on('connection', (socket) => {
        console.log(`User is connected: ${socket.id}`);


        //regiter user with socket to make secure 
        socket.on('register', (userId) => {
            onlineUsers.set(userId, socket.id);
            console.log(`User ${userId}registred with  socket ${socket.id}`);

        });

        // for text and voice message 
        socket.on('send-message', (data) => {
            const { reciverId } = data;
            const reciverSocketId = onlineUsers.get(reciverId);
            if (reciverId) {
                io.to(reciverSocketId).emit('recive-message', data);

            }
        });

        // Real-time message notification
        socket.on("send-message", async (data) => {
            const { to, from, message, senderName } = data;

            // Emit message to receiver
            const reciverSocketId = onlineUsers.get(to);
            if (reciverSocketId) {
                io.to(reciverSocketId).emit("receive-message", data);
            }

            // Create notification for the receiver
            await createNotification({
                to,
                from,
                type: "message",
                message: `New message from ${senderName}: ${message}`,
                io,
                onlineUsers,
            });
        });

        // Join group room
        socket.on('join-group', (groupId) => {
            socket.join(groupId); // user joins the group room
            console.log(`Socket ${socket.id} joined group ${groupId}`);
        });

        // Leave group room
        socket.on('leave-group', (groupId) => {
            socket.leave(groupId);
            console.log(`Socket ${socket.id} left group ${groupId}`);
        });

        // Send group message
        socket.on('send-group-message', (data) => {
            const { groupId, message, senderId, senderName } = data;

            // Emit message to all members in the group
            io.to(groupId).emit('receive-group-message', data);


            console.log(`Message sent to group ${groupId} by ${senderName}`);
        });

        // for disconnecting the socket connection

        socket.on('disconnect', () => {
            console.log(`Disconnect: ${socket.id}`);

            for (let [userId, id] of onlineUsers.entries()) {

                if (id == socket.id) {

                    onlineUsers.delete(userId);
                    break;
                }
            }
            
            console.log(`User disconnected: ${socket.id}`);

            });       
    });
};

//helper to emit events to a specific user

export const emitToUser= (userId,event,payload) =>{
    if(!io) return;
    console.log(onlineUsers);
    console.log(userId);
    const socketId= onlineUsers.get(userId.toString());
    console.log(socketId)
    if (socketId) {
        io.to(socketId).emit(event, payload);
    }
};


