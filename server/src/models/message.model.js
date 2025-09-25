import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required:true,
    },
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required:true,
    }, 
    message_type: {
        type: String,
        enum: ['text', 'image', 'video', 'file']
    },
    group: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Group",
        default: null,
    },
    text: {
        type:String,
        default:'',
    },
    media_url:{
        type:String,
        default:'',
    },
    seen:{
        type:Boolean,
        default:false,
    },
    createdAt:{
        type:Date,
        default:Date.now,
    }
},
    {
        timestamps: true
    }


)
const Message= mongoose.model("Message",messageSchema);
export default Message;