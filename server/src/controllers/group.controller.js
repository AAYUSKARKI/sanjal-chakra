import Group from "../models/group.model.js";
import Message from "../models/message.model.js";
import cloudinary from "../lib/cloudinary.js";

// Create a new group
export const createGroup = async (req, res) => {
    try {
        const { name, description, members } = req.body;

        let photoUrl = "";
        if (req.file) {
            const result = await cloudinary.uploader.upload(req.file.path, {
                folder: "group_photos",
            });
            photoUrl = result.secure_url;
        }

        const group = await Group.create({
            name,
            description,
            members: members ? [...members, req.user._id] : [req.user._id],
            admins: [req.user._id],
            photo: photoUrl,
        });

        res.status(201).json(group);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};



//invite members to group
export const inviteMembers = async (req, res) =>  {
    try {
        const { groupId } = req.params;
        const { userIds } = req.body; // array of user IDs
        const group = await Group.findById(groupId);

        if (!group) return res.status(404).json({ message: "Group not found" });

        // Only admin can invite
        if (String(group.admins) !== String(req.user._id)) {
            return res.status(403).json({ message: "Only admin can invite users" });
        }

        // Add new members if not already present
        userIds.forEach((id) => {
            if (!group.members.includes(id)) {
                group.members.push(id);
            }
        });

        await group.save();

         // Notify all existing members about new members
        group.members.forEach((memberId) => {
            if (String(memberId) !== String(req.user._id)) {
                req.io.to(memberId.toString()).emit("groupNotification", {
                    message: `${req.user.username} added new members to ${group.name}`,
                    groupId,
                });
            }
        });

        res.status(200).json({ message: "Users invited successfully", group });
        res.status(200).json({ message: "Users invited successfully", group });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }

};


//remove members from group 
export const removeMember = async (req, res) => {
    try {
        const { groupId, memberId } = req.params;
        const group = await Group.findById(groupId);

        if (!group) return res.status(404).json({ message: "Group not found" });

        // Only admin can remove members
        if (String(group.admins) !== String(req.user._id)) {
            return res.status(403).json({ message: "Only admin can remove members" });
        }

        // Admin cannot remove himself here
        if (String(group.admins) === String(memberId)) {
            return res.status(403).json({ message: "Admin cannot remove themselves" });
        }

        group.members = group.members.filter((m) => String(m) !== String(memberId));
        await group.save();

        //Notify all members about member removal
        group.members.forEach((id) => {
            req.io.to(id.toString()).emit("groupNotification", {
                message: `${req.user.username} removed a member from ${group.name}`,
                groupId,
            });
        });

        res.status(200).json({ message: "Member removed successfully", group });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


//leave group
export const leaveGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        const group = await Group.findById(groupId);

        if (!group) return res.status(404).json({ message: "Group not found" });

        // Admin cannot leave without assigning new admin
        if (String(group.admins) === String(req.user._id)) {
            return res.status(400).json({
                message: "You are the admin. Transfer admin role before leaving."
            });
        }

        group.members = group.members.filter((m) => String(m) !== String(req.user._id));
        await group.save();

        // Notify all members about member leaving
        group.members.forEach((id) => {
            req.io.to(id.toString()).emit("groupNotification", {
                message: `${req.user.username} has left the group ${group.name}`,
                groupId,
            });
        });

        res.status(200).json({ message: "You have left the group", group });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

//give admin role to another member 
export const transferAdmin = async (req, res) => {
    try {
        const { groupId, newAdminId } = req.body;
        const group = await Group.findById(groupId);

        if (!group) return res.status(404).json({ message: "Group not found" });

        // Only current admin can transfer
        if (String(group.admin) !== String(req.user._id)) {
            return res.status(403).json({ message: "Only current admin can transfer admin role" });
        }

        // New admin must be a member
        if (!group.members.includes(newAdminId)) {
            return res.status(400).json({ message: "New admin must be a member of the group" });
        }

        // Transfer admin role
        group.admins = newAdminId;

        await group.save();

        // Notify all members about admin is another member 

        group.members.forEach((id) => {
            req.io.to(id.toString()).emit("groupNotification", {
                message: `${req.user.username} transferred admin role to another member`,
                groupId,
            });
        });
        res.status(200).json({ message: "Admin role transferred successfully", group });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


// Send message to group
export const sendMessage = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { text } = req.body;

        let imageUrl = "";
        if (req.file) {
            const result = await cloudinary.uploader.upload(req.file.path, {
                folder: "message_images",
            });
            imageUrl = result.secure_url;
        }

        const message = await Message.create({
            sender: req.user._id,
            group: groupId,
            text,
            imageUrl,
        });

        // Emit message to group room
        req.io.to(groupId).emit("newMessage", message);

        // Notify all group members except sender
        const group = await Group.findById(groupId);
        group.members.forEach((memberId) => {
            if (memberId.toString() !== req.user._id.toString()) {
                req.io.to(memberId.toString()).emit("notification", {
                    message: `New message in group: ${group.name}`,
                    groupId,
                });
            }
        });

        res.status(201).json(message);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get messages of a group
export const getMessages = async (req, res) => {
    try {
        const { groupId } = req.params;
        const messages = await Message.find({ group: groupId })
            .populate("sender", "username email")
            .sort({ createdAt: 1 });

        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Update group info (name, description, photo)
export const updateGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { name, description } = req.body;

        const updateData = {};
        if (name) updateData.name = name;
        if (description) updateData.description = description;

        if (req.file) {
            const result = await cloudinary.uploader.upload(req.file.path, {
                folder: "group_photos",
            });
            updateData.photo = result.secure_url;
        }

        const updatedGroup = await Group.findByIdAndUpdate(groupId, updateData, { new: true });

        // Notify all members about group update
        updatedGroup.members.forEach((memberId) => {
            req.io.to(memberId.toString()).emit("groupUpdated", updatedGroup);
        });

        res.json(updatedGroup);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
