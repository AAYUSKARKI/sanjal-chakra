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
    
    group: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Group",
        required: true,
    },

    text: {
        type:String,
        default:'',
    },
    image:{
        type:String,
        default:'',

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