import mongoose from "mongoose";
import User from "./user.model.js";

const storySchema = new mongoose.Schema(
    {

        user:
         {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        storyImage: 
        {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
        caption: {
            type: String,
            trim: true,
            maxlength: 500, 
        },
        expiresAt: {
            type: Date,
            default: () => Date.now() + 24 * 60 * 60 * 1000, // expires in 24 hours
            index: { expires: "0s" }, //auto delete the story after 24 hours
        },
    },

    {
        timestamps: true,
    }




);
const Story = mongoose.model("Story",storySchema);

export default Story;