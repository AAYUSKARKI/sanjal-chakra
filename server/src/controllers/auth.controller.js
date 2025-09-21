import bcrypt from "bcryptjs"
import User from "../models/user.model.js"
import { generateToken } from "../utils/generatetokens.js"
import sendOtp from "../lib/nodemailer.js"

export const signup = async (req, res) => {
    const { fullname, password, email } = req.body
    try {
        if (!fullname || !password || !email) return res.status(400).json({ message: "All fields are required" })
        if (password < 8) {
            return res.status(400).json({ message: "password must be alleat 8 character" })
        }
        //check the user already exist
        const user = await User.findOne({ email })
        if (user) {
            return res.status(400).json({ message: "User already exist" })
        }
        // Hash the password
        const salt = await bcrypt.genSalt(13);
        const hashedPassword = await bcrypt.hash(password, salt);

        // generate otp and its expire time
        const verifyOtp = Math.floor(100000 + Math.random() * 900000);
        const verifyOtpExpireAT = Date.now() + 10 * 60 * 1000;
        // Create the user
        const newUser = new User({
            fullname,
            email,
            password: hashedPassword,
            verifyOtp,
            verifyOtpExpireAT
        });
        console.log(newUser)
        //check if the user is created, if yes:genrate a jwt and save user in the database
        if (newUser) {
            generateToken(newUser._id, res);
            await newUser.save();
            await sendOtp(email, verifyOtp);

            res.status(201).json({
                _id: newUser._id,
                fullname: newUser.fullname,
                email: newUser.email,
                password: newUser.password,
                profilePics: newUser.profilePics
            })
        }
        else {
            return res.status(400).json({ message: "Invalid Credentials!!" })

        }




    }
    catch (error) {
        console.log("SignUp Error:", error.message);
        res.status(500).json({ message: "Internal Server Error!!" })

    }
}

//verify otp code
export const verifyOtp = async (req, res) => {
    const { email, otp } = req.body;
    try {
        if (!email || !otp) return res.status(400).json({ message: "All fields are required" })

        const user = await User.findOne({ email })
        // console.log(user)
        if (!user) {
            return res.status(400).json({ message: "Invalid  Credentials!!" })
        }
        // console.log(otp,"otp from client")
        // console.log(user)
        // console.log(user.verifyOtp,"otp from db")
        if (user.verifyOtp !== otp) {
            return res.status(400).json({ message: "Invalid OTP!!" })
        }

        if (user.verifyOtpExpireAT < Date.now()) {
            return res.status(400).json({ message: "OTP Expired!!" })
        }

        user.isVerified = true;
        // user.verifyOtp = "";
        // user.verifyOtpExpireAT = 0;
        await user.save();
        const token = generateToken(user._id, res)
        res.status(200).json({
            _id: user._id,
            email: user.email,
            fullName: user.fullname,
            token
        })
    } catch (error) {
        console.log("VerifyOtp Error:", error);
        res.status(500).json({ message: "Internal Server Error!!" })

    }
}
// login code
export const login = async (req, res) => {
    const { password, email } = req.body
    try {
        if (!email || !password) return res.status(400).json({ message: "All fields are required" })
        const user = await User.findOne({ email })
        if (!user) {
            return res.status(400).json({ message: "Invalid  Credentials!!" })
        }
        const isValid = await bcrypt.compare(password, user.password)
        if (!isValid) {
            return res.status(400).json({ message: "Invalid  Credentials!!" })
        }
        const token = generateToken(user._id, res)
        res.status(200).json({
            _id: user._id,
            email: user.email,
            fullName: user.fullname,
            bio:user.bio,
            location:user.location,
            profilePics:user.profilePics,
            coverPic:user.coverPic,
            followers:user.followers,
            following:user.following,
            token
        })



    } catch (error) {
        console.log("LogIn Error:", error);
        res.status(500).json({ message: "Internal Server Error!!" })

    }

}
//logout code
export const logout = async (req, res) => {
    try {
        res.cookie("jwt", {
            maxAge: 0,
            httpOnly: true,
            sameSite: "strict",
            secure: process.env.NODE_ENV !== "development"
        })
        res.status(200).json({ message: 'Logged out successfully' })


    }
    catch (error) {
        console.log("LogIn Error:", error);
        res.status(500).json({ message: "Internal Server Error!!" })

    }
}