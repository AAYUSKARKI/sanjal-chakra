import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Loading from '../components/Loading'
import UserProfileInfo from '../components/UserProfileInfo'
import PostCard from '../components/PostCard'
import moment from 'moment'
import ProfileModal from '../components/ProfileModal'
import useAuth from '../hooks/useAuth'
import { getMyPosts } from '../api/api'
import API from '../api/api'
const Profile = () => {

 const {profileID} =useParams()
 const {user}= useAuth()
 const [posts, setPosts] = useState([])
 const [profileUser, setProfileUser] = useState(null)
 const [activeTab, setActiveTab] = useState('posts')
 const [showEdit, setShowEdit] = useState(false)
  
useEffect(() => {
    const fetchData = async () => {
      try {
        if (profileID && profileID !== user._id) {
          // Fetch another user's profile
          const { data } = await API.get(`/users/${profileID}`, { withCredentials: true });
          setProfileUser(data.user);
          setPosts(data.posts || []);
        } else {
          // Use logged-in user's data
          const data = await getMyPosts();
          setProfileUser(user);
          setPosts(data.posts || []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    fetchData();
  }, [profileID, user]);
  console.log(profileUser)
  return user ? (
    <div className='relative h-full overflow-y-scroll bg-gray-50 p-6'>
      <div className='max-w-3xl mx-auto'>
         {/* Profile Card */}
         <div className='bg-white rounded-2xl shadow overflow-hidden'>
               {/* Cover Photo */}
               <div className='h-40 md:h-56 bg-gradient-to-r from-indigo-200 via-purple-200 to-pink-200'>
                   {user && <img src={profileUser && profileUser?.cover_photo ? profileUser.cover_photo : "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200"} alt="" className='w-full h-full object-cover'/> }
               </div>
               {/* User Info */}
               <UserProfileInfo user={profileID ? profileUser : user} posts={posts} profileId={profileID} setShowEdit={setShowEdit}/>
          </div>

          {/* Tabs */}

            <div className='mt-6'>
                <div className='bg-white rounded-xl shadow p-1 flex max-w-md mx-auto'>
                  {["posts", "media", "likes"].map((tab)=>(
                    <button onClick={()=> setActiveTab(tab)} key={tab} className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${activeTab === tab ? "bg-indigo-600 text-white" : "text-gray-600 hover:text-gray-900"}`}>
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>

                   {/* Posts */}
                   {activeTab === 'posts' &&  (
                    <div className='mt-6 flex flex-col items-center gap-6'>
                      {posts.map((post)=> <PostCard key={post._id} post={post}/>)}
                    </div>
                   )}

                     {/* Media */}
                     {activeTab === 'media' && (
                      <div className='flex flex-wrap mt-6 max-w-6xl'>
                        {
                          posts.filter((post)=>post.image.length > 0).map ((post)=>(
                            <>
                            {post.image.map((image, index)=> (
                              <Link target='_blank' to={image} key={index} className='relative group'>
                              <img src={image} key={index} className='w-64 aspect-video object-cover' alt="" />
                              <p className='absolute bottom-0 right-0 text-xs p-1 px-3 backdrop-blur-xl text-white opacity-0 group-hover:opacity-100 transition duration-300'>Posted{moment(post.createdAt).fromNow()}</p>
                              </Link>
                            ))}
                            </>
                          ))
                        }
                      </div>
                     )}


            </div>
      </div> 
          {/* Edit Profile Modal */}
            {showEdit && <ProfileModal setShowEdit={setShowEdit}/>}
    </div>
  ) : (<Loading />)
}

export default Profile
