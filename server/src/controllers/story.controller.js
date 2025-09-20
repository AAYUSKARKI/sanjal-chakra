import Story from "../models/story.model.js";
import cloudinary from "../lib/cloudinary.js";
import { notifyFollowers } from "./post.controller.js";

export const createStory = async (req, res) => {
  const { caption, background_color } = req.body; 
  const storyMedia = req.file; 
  let media_url = "";
  let media_type = "";

  try {
    if (!caption && !storyMedia) {
      return res.status(400).json({ message: "Text or media is required." });
    }

    if (storyMedia) {
      const mime = storyMedia.mimetype;
      const mimeToTypeMap = {
        "image/jpeg": "image",
        "image/png": "image",
        "image/gif": "image", 
        "video/mp4": "video",
        "video/quicktime": "video", 
      };

      media_type = mimeToTypeMap[mime];
      if (!media_type) {
        return res.status(400).json({ message: "Unsupported media type. Only images and videos are allowed." });
      }

      // Upload to Cloudinary with dynamic resource_type
      const resource_type = media_type; // Matches Cloudinary's types (image/video)
      const base64Media = `data:${mime};base64,${storyMedia.buffer.toString("base64")}`;
      const result = await cloudinary.uploader.upload(base64Media, {
        resource_type,
        folder: "stories",
      });
      console.log(result); // For debugging
      media_url = result.secure_url;
    } else {
      // No media: Treat as text story
      media_type = "text";
    }

    // Create story: content = caption (for text or media caption)
    const newStory = await Story.create({
      user: req.user._id,
      content: caption || "", // Empty if media-only
      media_url,
      media_type,
      background_color: background_color || "#4f46e5", // Use provided or default
    });
    notifyFollowers(req.user._id, req.user.fullname, newStory._id);
    console.log({ media_url, media_type }); // For debugging
    return res.status(201).json({ message: "Story created successfully", story: newStory });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error while creating story." });
  }
};


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