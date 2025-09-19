import Message from "../models/message.model.js";
import cloudinary from "../lib/cloudinary.js";
import { emitToUser } from "../sockets/socket.io.js";
import { createNotification } from "./notification.controller.js";
import fs from "fs/promises";

export const sendMessage = async (req, res) => {
    const { sender, receiver, text } = req.body;
    const image = req.file;
    let imageUrl = '';

    try {
        // Validate sender and receiver
        if (!sender || !receiver) {
            return res.status(400).json({ message: "Sender and receiver are required." });
        }

        // Validate that at least text or image is provided
        if (!text && !image) {
            return res.status(400).json({ message: "Text or image message is required." });
        }

        // Upload image if present
        if (image) {
            const result = await cloudinary.uploader.upload(image.path, {
                resource_type: "image", // Automatically detect type
            });
            imageUrl = result.secure_url;

            // Remove local file after upload
            await fs.unlink(image.path);
        }

        // Save message in DB
        const message = await Message.create({
            sender,
            receiver,
            text,
            imageUrl,
        });

        // Emit message to receiver in real-time
        emitToUser(receiver, "receive-message", {
            messageId: message._id,
            sender,
            text,
            imageUrl,
            createdAt: message.createdAt,
        });

        // Create a notification for receiver
        await createNotification({
            userId: receiver,
            type: "message",
            message: `${sender} sent you a message`,
            referenceId: message._id,
        });

        // Respond with message data
        return res.status(200).json({
            message: "Message sent successfully",
            data: {
                _id: message._id,
                sender: message.sender,
                receiver: message.receiver,
                text: message.text,
                imageUrl: message.imageUrl,
                createdAt: message.createdAt,
            }
        });

    } catch (error) {
        console.error("Message error:", error);
        return res.status(500).json({ message: "Internal Server Error!" });
    }
};
