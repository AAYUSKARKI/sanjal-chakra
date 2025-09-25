import { useEffect, useRef, useState } from 'react'
import { ImageIcon, SendHorizonal } from 'lucide-react'
import { Phone, Video } from 'lucide-react'
import useAuth from '../hooks/useAuth'
import { useParams } from 'react-router-dom'
import API from '../api/api'
import { socket } from '../utils/socket'

const ChatBox = () => {

  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [image, setImage] = useState(null)
  const [receiver, setReceiver] = useState(null)
  const { user } = useAuth()
  const { userId } = useParams()
  const messageEndRef = useRef(null)

  const fetchReceiver = async () => {
    try {
      const { data } = await API.get(`/users/${userId}`, { withCredentials: true });
      setReceiver(data.user);
    } catch (error) {
      console.log(error)
    }
  }

  const fetchMessages = async () => {
    try {
      const { data } = await API.get(`/message/${userId}`, { withCredentials: true });
      setMessages(data.messages);
    }
    catch (error) {
      console.log(error)
    }
  }

  useEffect(() => {
    fetchReceiver()
    fetchMessages()
  }, [userId])

  useEffect(() => {
    if (user) {
      socket.connect();
      socket.emit("register", userId);
      socket.emit("register", user._id);

      socket.on("receive-message", (message) => {
        console.log("New message received:", message);
        if (message.sender === user._id || message.receiver === userId) {
          console.log("Updating messages state with new message");
          setMessages((prevMessages) => [...prevMessages, message]);
        }
      });
    }
    return () => {
      socket.disconnect();
    };
  }, [user]);

  const sendMessage = async () => {
    if (!text && !image) return;
    const formData = new FormData();
    formData.append('sender', user._id);
    formData.append('text', text);
    formData.append('message_type', image ? 'image' : 'text');
    if (image) {
      formData.append('image', image);
    }
    try {
      const { data } = await API.post(`/message/send/${userId}`, formData, {
        withCredentials: true,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setMessages([...messages, data.data]);
      setText('');
      setImage(null);
    } catch (error) {
      console.log(error);
    }
  }

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  return receiver && (
    <div className='flex flex-col h-screen'>
      <div className='flex items-center gap-2 p-2 md:px-10 xl:pl-42 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-300 '>
        <img src={receiver.profile_picture || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200"} alt="" className='size-8 rounded-full' />
        <div>
          <p className='font-medium'>{receiver.fullname}</p>
          <p className='text-sm text-gray-500 -mt-1.5'>@{receiver.fullname}</p>


          {/* Call buttons */}
          <div className="flex gap-3 ">
            <button
              onClick={() => console.log("Audio call started")}
              className="p-2 rounded-full bg-green-500 text-white hover:bg-green-600"
            >
              <Phone size={18} />
            </button>

            <button
              onClick={() => console.log("Video call started")}
              className="p-2 rounded-full bg-blue-500 text-white hover:bg-blue-600"
            >
              <Video size={18} />
            </button>
          </div>



        </div>
      </div>
      <div className='p-5 md:px-10 h-full overflow-y-scroll'>
        <div className='space-y-4 max-w-4xl max-auto'>

          {
            messages.toSorted((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).map((message, index) => (
              <div key={index} className={`flex flex-col ${message.to_user_id !== user._id ? 'items-start' : 'items-end'}`}>
                <div className={`p-2 text-sm max-w-sm bg-white text-slate-700 rounded-lg shadow ${message.to_user_id !== user._id ? 'rounded-bl-none' : 'rounded-br-none'}`}>
                  {
                    message.message_type === 'image' && <img src={message.media_url}
                      className='w-full max-w-sm rounded-lg mb-1' alt="" />
                  }
                  <p>{message.text}</p>
                </div>
              </div>
            ))
          }
          <div ref={messageEndRef} />
        </div>
      </div>

      <div className='px-4'>
        <div className='flex items-center gap-3 pl-5 p-1.5 bg-white w-full max-w-xl mx-auto border border-gray-200 shadow rounded-full mb-5 '>
          <input type="text" className='flex-1 outline-none text-slate-700'
            placeholder='Type a message...'
            onKeyDown={e => e.key === 'Enter' && sendMessage()} onChange={(e) => setText(e.target.value)}
            value={text} />

          <label htmlFor="image">
            {
              image
                ? <img src={URL.createObjectURL(image)} alt="" className='h-8 rounded' />
                : <ImageIcon className='size-7 text-gray-400 cursor-pointer' />
            }
            <input type="file" id="image" accept="image/*" hidden onChange={(e) => setImage(e.target.files[0])} />
          </label>


          <button onClick={sendMessage} className='bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-700 hover:to-purple-800 active:scale-95 cursor-pointer text-white p-2 rounded-full'>
            <SendHorizonal size={18} />
          </button>

        </div>

      </div>

    </div>
  )
}

export default ChatBox
