import express from "express";
import { followUser, unfollowUser, getFollowers, getFollowing, setbio, getbio,getAllUsers} from "../controllers/user.controller.js";
import { getMyProfile } from "../controllers/user.controller.js";
import protectRoute from "../middleware/auth.middleware.js";

const router = express.Router();

// follow & unfollow
router.put("/:userId/follow", protectRoute, followUser);
router.put("/:userId/unfollow", protectRoute, unfollowUser);

// get followers & following (protected)
router.get("/:userId/followers", protectRoute, getFollowers);
router.get("/:userId/following", protectRoute, getFollowing);

// get own profileic
router.get("/me", protectRoute, getMyProfile);

//set the bio
router.put('/', protectRoute, setbio);

//get a bio
router.get('/', protectRoute,getbio);

//get all users
router.get('/all',protectRoute,getAllUsers);




export default router;
