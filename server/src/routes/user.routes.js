import express from "express";
import { followUser, unfollowUser, getFollowers, getFollowing, setbio, getbio,getAllUsers,sendConnectionRequest,acceptConnectionRequest,rejectConnectionRequest,removeConnection,getConnections,getPendingConnectionRequests} from "../controllers/user.controller.js";
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

//get connections
router.get('/:userId/getconnections',protectRoute,getConnections);

//send connection request
router.post('/:userId/sendrequest',protectRoute,sendConnectionRequest);

//accept connection request
router.post('/:userId/acceptrequest',protectRoute,acceptConnectionRequest);

//reject connection request
router.post('/:userId/rejectrequest',protectRoute,rejectConnectionRequest);

//remove connection
router.post('/:userId/removeconnection',protectRoute,removeConnection);

//get pending connection requests
router.get('/:userId/pendingconnections',protectRoute,getPendingConnectionRequests);


export default router;
