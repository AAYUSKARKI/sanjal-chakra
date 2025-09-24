import { useEffect, useState } from 'react'
import { Eye, MessageSquare } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import API from '../api/api'
import useAuth from '../hooks/useAuth'

const Messages = () => {
  const [connections, setConnections] = useState([])
  const { user } = useAuth()

  const getConnections = async () => {
    try {
      const { data } = await API.get(`/users/${user._id}/getconnections`, { withCredentials: true })
      setConnections(data)
    } catch (error) {
      console.log(error)
    }
  }

  useEffect(() => {
    getConnections()
  }, [])
  const navigate = useNavigate()

  return (
    <div className='min-h-screen relative bg-slate-50 '>
      <div className='max-w-6xl mx-auto p-6'>
        {/* Title */}
        <div className='mn-8'>
          <h1 className='text-3xl font-bold text-slate-900 mb-2'>
            Messages
          </h1>
          <p className='text-slate-600'>
            Talk to your friends and family
          </p>
        </div>

        {/* Connected Users */}
        <div className='flex flex-col gap-3'>
          {connections.map((user) => (
            <div key={user._id} className='max-w-xl flex flex-wrap gap-5 p-6 bg-white shadow rounded-md'>
              <img src={user.profile_picture || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200"} alt="" className='rounded-full size-12 mx-auto' />
              <div className='flex-1'>
                <p className='font-medium text-slate-700'>{user.fullname}</p>
                <p className='text-slate-500'>@{user.fullname}</p>
                <p className='text-sm text-gray-600'>{user.bio || 'No bio'}</p>
              </div>

              <div className='flex flex-col gap-2 mt-4'>
                <button onClick={() => navigate(`/messages/${user._id}`)} className='size-10 flex items-center justify-center text-sm rounded bg-slate-100 hover:bg-slate-200 text-slate-800 active:scale-95 transition cursor-pointer gap-1'>
                  <MessageSquare className='w-4 h-4' />
                </button>
                <button onClick={() => navigate(`/profile/${user._id}`)} className='size-10 flex items-center justify-center text-sm rounded bg-slate-100 hover:bg-slate-200 text-slate-800 active:scale-95 transition cursor-pointer'>
                  <Eye className='w-4 h-4' />
                </button>
              </div>

            </div>
          ))}
        </div>

      </div>
    </div>
  )
}

export default Messages
