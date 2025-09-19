import express from "express";
import multer from "multer";
import { sendMessage } from "../controllers/message.controller.js";
import  protectRoute  from "../middleware/auth.middleware.js";
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/image/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});

const upload = multer({ storage });

const router = express.Router();

router.post('/send', protectRoute, upload.single('image'), sendMessage);

export default router;
