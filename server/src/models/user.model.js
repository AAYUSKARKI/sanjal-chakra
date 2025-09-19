import mongoose from "mongoose"
const userSchema = mongoose.Schema(
  {
    fullname: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },


    socketId:String,


    password: {
      type: String,
      required: true,
      minLength:8
    },

    verifyOtp: {
      type: String,
      default: '',
    },
    verifyOtpExpireAT: {
      type: Number,
      default: 0,
    },
    isAccountVerified: {
      type: Boolean,
      default: false,
    },
    reSetOtp: {
      type: String,
      default: '',
    },
    reSetOtpExpireAT: {
      type: Number,
      default: 0,

    },



    profilePics: {
      type: String,
      default:''
    },

    coverPic:{
      type:String,
      default:'',
    },
    bio:{
      type:String,
      maxlength: 200,
      default:'',
    },
    location:{

      type:String,
      maxlength: 200,
      default:'',

    },

    followers:[{
      type:mongoose.Schema.Types.ObjectId,
      ref:"User"
      
    }],
    
    following:[{

      type:mongoose.Schema.Types.ObjectId,
      ref:"User"
,



    }]



  },
  {
    timestamps: true,
  }
);
const User=mongoose.model("User",userSchema)

export default User