import express from "express";
import { createGroup, sendMessage, updateGroup, getMessages } from "../controllers/group.controller.js";
import upload from "../middleware/upload.middleware.js";
import  protectRoute from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/groups", protectRoute, upload.single("photo"), createGroup);
router.patch("/groups/:groupId", protectRoute, upload.single("photo"), updateGroup);
router.get("/groups/:groupId/messages", protectRoute, getMessages);
router.post("/groups/:groupId/messages", protectRoute, upload.single("file"), sendMessage);

export default router;
