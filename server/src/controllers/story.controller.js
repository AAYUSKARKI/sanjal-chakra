import Story from "../models/story.model.js";
import cloudinary from "../lib/cloudinary.js";
import fs from "fs/promises";
import { createNotification } from "./notification.controller.js";

export const createStory = async (req, res) => {
    const { caption } = req.body;
    const { storyImage } = req.file;
    let imageUrl = '';



    try {
        if (!caption && !storyImage) {
            return res.status(400).json({ message: "Text or image message is required." });

        }
        if (image) {
            const result = await cloudinary.uploader.upload(storyImage.path, {
                resource_type: "storyImage ",
            });

            imageUrl = result.secure_url;

            await fs.unlink(storyImage.path);
        }

        const createStory = await Message.create({
            userId,
            caption,
            imageUrl,
        });


        await notifyFollowers(userId, req.user.name, createStory._id);
        res.status(201).json({ message: "Story created successfully", post: createStory });
    }




    catch (error) {
        console.error("Create story error:", err);
        res.status(500).json({ message: "Internal server error" });

    }



}


export const getStory = async (req,res) =>{

    const stories = await Story.find()
        .populate("user", "fullname profilePic")
        .sort({ createdAt: -1 });
    res.status(200).json({ success: true, stories });




    try {
        
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error" });
        
    }




















}