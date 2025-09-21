import User from "../models/user.model.js";
import Notifi from "../models/notification.model.js";
import Post from "../models/post.model.js";


//  FOLLOW USER 
export const followUser = async (req, res) => {
    try {
        const { userId } = req.params; // ID of user to follow
        const currentUser = req.user._id;

        if (userId === String(currentUser)) {
            return res.status(400).json({ message: "You cannot follow yourself" });
        }

        const userToFollow = await User.findById(userId);
        if (!userToFollow) return res.status(404).json({ message: "User not found" });

        // Check if already following
        if (userToFollow.followers.includes(currentUser)) {
            return res.status(400).json({ message: "Already following this user" });
        }

        // update followers/following  
        userToFollow.followers.push(currentUser);
        await userToFollow.save();

        await User.findByIdAndUpdate(currentUser, { $push: { following: userId } });

        res.status(200).json({ message: "User followed successfully" });

        //CREATE NOTIFICATION
        const notification = new Notification({
            sender: currentUser,
            receiver: userId,
            type: "follow",
        });
        await notification.save();









    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// UNFOLLOW USER 
export const unfollowUser = async (req, res) => {
    try {
        const { userId } = req.params; // ID of user to unfollow
        const currentUser = req.user._id;

        if (userId === String(currentUser)) {
            return res.status(400).json({ message: "You cannot unfollow yourself" });
        }

        const userToUnfollow = await User.findById(userId);
        if (!userToUnfollow) return res.status(404).json({ message: "User not found" });

        // Check if not following
        if (!userToUnfollow.followers.includes(currentUser)) {
            return res.status(400).json({ message: "You are not following this user" });
        }

        userToUnfollow.followers.pull(currentUser);
        await userToUnfollow.save();

        await User.findByIdAndUpdate(currentUser, { $pull: { following: userId } });

        res.status(200).json({ message: "User unfollowed successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

//  GET FOLLOWERS 
export const getFollowers = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId).populate("followers", "username fullname profilepiecture");
        if (!user) return res.status(404).json({ message: "User not found" });

        res.status(200).json(user.followers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

//  GET FOLLOWING 
export const getFollowing = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId).populate("following", "username fullname profilepiecture");
        if (!user) return res.status(404).json({ message: "User not found" });

        res.status(200).json(user.following);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


// GET OWN PROFILE 
export const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .select("-password -__v")
            .populate("followers", "username fullname profilePicture")
            .populate("following", "username fullname profilePicture");

        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

//  GET MY PROFILE WITH POSTS
export const getMyProfile = async (req, res) => {
    try {
        const currentUserId = req.user._id;

        const user = await User.findById(currentUserId)
            .select("-password -__v")
            .populate("followers", "fullname profilePicture ")
            .populate("following", "fullname profilePicture ")
            .lean();

        if (!user) return res.status(404).json({ message: "User not found" });

        const posts = await Post.find({ userId: currentUserId }).sort({ createdAt: -1 });

        res.status(200).json({ user, posts });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

//  GET OTHER USER PROFILE WITH POSTS 
export const getUserProfile = async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user._id;

        const user = await User.findById(userId)
            .select("-email -password -__v -createAT -updatedAt")
            .populate("followers", "fullname profilePics")
            .populate("following", "fullname profilePics")
            .lean();

        if (!user) return res.status(404).json({ message: "User not found" });

        // Check if current user is following this user
        const isFollowing = user.followers.some(follower => String(follower._id) === String(currentUserId));

        // Calculate mutual followers
        const currentUser = await User.findById(currentUserId)
            .select("following followers")
            .populate("following", "fullname profilePics")
            .populate("followers", "fullname profilePics")
            .lean();

        // Mutual followers = users that both follow each other
        const mutualFollowers = user.followers.filter(follower =>
            currentUser.following.some(f => String(f._id) === String(follower._id))
        );

        const posts = await Post.find({ userId }).sort({ createdAt: -1 });

        res.status(200).json({
            user,
            posts,
            isFollowing,
            mutualFollowers
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

//inside of bio there is profilepic,coverpic,bio,and location
export const setbio = async (req, res) => {
    try {
        const userId = req.user.id;
        const { bio, location } = req.body;


        if (bio && bio.length > 200) {
            return res.status(400).json({ message: "Bio must be under 200 characters" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }


        if (bio) user.bio = bio;
        if (location) user.location = location;


        if (req.file?.profilePics) {
            const uploadPP = await cloudinary.uploader.upload(req.file.profilePics);
            user.profilePics = uploadPP.secure_url;
        }


        if (req.file?.coverPic) {
            const uploadCover = await cloudinary.uploader.upload(req.file.coverPic);
            user.coverPic = uploadCover.secure_url;
        }

        await user.save();

        res.status(200).json({ message: "Profile updated successfully", profile: user });

    } catch (error) {
        console.log("Error:", error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};


//get the all bio 
export const getbio = async (req, res) => {
    try {
        const userId = req.params.id; // get user ID from URL
        const user = await User.findById(userId).select("-password, -email");

        if (!user) {
            return res.status(404).json({ message: "Bio not found" });
        }

        res.status(200).json(user);
    } catch (error) {
        console.log("Error:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

//get all users except current user
export const getAllUsers = async (req, res) => {
    try {
        const userId = req.user._id;
        const users = await User.find({ _id: { $ne: userId } }).select("-password, -email");

        res.status(200).json(users);
    } catch (error) {
        console.log("Error:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};


