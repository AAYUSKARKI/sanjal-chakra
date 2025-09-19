import Story from "../models/story.model.js";
import cloudinary from "../lib/cloudinary.js";
import fs from "fs/promises";
import { notifyFollowers } from "./post.controller.js";

export const createStory = async (req, res) => {
    const { caption } = req.body;
    const storyImage = req.file;
    let imageUrl = '';

    try {
        if (!caption && !storyImage) {
            return res.status(400).json({ message: "Text or image message is required." });

        }
        if (storyImage) {
            // Convert buffer to base64 for Cloudinary upload
            const base64Image = `data:${storyImage.mimetype};base64,${storyImage.buffer.toString('base64')}`;
            const result = await cloudinary.uploader.upload(base64Image, {
                resource_type: "image",
                folder: "stories",
            });
            console.log(result)
            imageUrl = result.secure_url;
        }
        console.log(imageUrl)
        const createStory = await Story.create({
            user: req.user._id,
            caption,
            storyImage: imageUrl,
        });


        await notifyFollowers(req.user._id, req.user.name, createStory._id);
        res.status(201).json({ message: "Story created successfully", post: createStory });
    }




    catch (error) {
        console.error("Create story error:", error);
        res.status(500).json({ message: "Internal server error" });

    }



}


export const getStory = async (req, res) => {

    const stories = await Story.find()
        .populate("user", "fullname profilePic")
        .sort({ createdAt: -1 });
    res.status(200).json({ success: true, stories });




    try {

    } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error" });

    }




















}