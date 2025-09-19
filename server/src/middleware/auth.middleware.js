// Import the jsonwebtoken package for decoding and verifying tokens
import jwt from "jsonwebtoken"
import User from "../models/user.model.js";

// Custom middleware to authenticate user

 const protectRoute = async (req, res, next) => {
     try {
         const { token } = req.cookies;
console.log(token)
         if (!token) {
             return res.status(401).json({
                 success: false,
                 message: "Not Authorized. Please login again",
             });
         }

         // Verify token
         const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
         console.log(decoded)
         if (!decoded?.userId) {
             return res.status(401).json({
                 success: false,
                 message: "Not Authorized. Invalid token",
             });
         }

         // Fetch user from DB (without password)
         const user = await User.findById(decoded.userId).select("-password");

         if (!user) {
             return res.status(404).json({
                 success: false,
                 message: "User not found",
             });
         }

         // Attach user to request
         req.user = user;

         next();
     } catch (error) {
         console.error("Auth middleware error:", error);
         return res.status(500).json({
             success: false,
             message: "Internal server error",
             error: error.message,
         });
     }
 };
export default protectRoute;
