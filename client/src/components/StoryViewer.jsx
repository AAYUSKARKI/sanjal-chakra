import { BadgeCheck, X, Trash2Icon } from 'lucide-react';
import { useEffect, useState } from 'react';
import useAuth from '../hooks/useAuth';
import API from '../api/api';
import toast from 'react-hot-toast';

const StoryViewer = ({ viewStory, setViewStory, fetchStories }) => {
  const [progress, setProgress] = useState(0);
  const { user } = useAuth();
  const isOwnStory = viewStory && viewStory.user?._id === user?._id;

  const handleStoryDelete = async () => {
    try {
      await API.delete(`/story/${viewStory._id}`, { withCredentials: true });
      toast.success('Story deleted successfully');
      setViewStory(null);
      fetchStories(); // Refetch stories after deletion
    } catch (error) {
      toast.error('Failed to delete story');
      console.error('Error deleting story:', error);
    }
  };

  useEffect(() => {
    let timer, progressInterval;

    if (viewStory && viewStory.media_type !== 'video') {
      setProgress(0);
      const duration = 10000;
      const setTime = 100;
      let elapsed = 0;

      progressInterval = setInterval(() => {
        elapsed += setTime;
        setProgress((elapsed / duration) * 100);
      }, setTime);

      // Close story after duration (10sec)
      timer = setTimeout(() => {
        setViewStory(null);
      }, duration);
    }

    return () => {
      clearTimeout(timer);
      clearInterval(progressInterval);
    };
  }, [viewStory, setViewStory]);

  const handleClose = () => {
    setViewStory(null);
  };

  if (!viewStory) return null;

  const renderContent = () => {
    switch (viewStory.media_type) {
      case 'image':
        return <img src={viewStory.media_url} alt="" className="max-w-full max-h-screen object-contain" />;
      case 'video':
        return (
          <video
            onEnded={() => setViewStory(null)}
            src={viewStory.media_url}
            className="max-h-screen"
            controls
            autoPlay
          />
        );
      case 'text':
        return (
          <div className="w-full h-full flex items-center justify-center p-8 text-white text-2xl text-center">
            {viewStory.content}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className="fixed inset-0 h-screen bg-black bg-opacity-90 z-110 flex items-center justify-center"
      style={{ backgroundColor: viewStory.media_type === 'text' ? viewStory.background_color : '#000000' }}
    >
      {/* Progress Bar */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gray-700">
        <div className="h-full bg-white transition-all duration-100 linear" style={{ width: `${progress}%` }}></div>
      </div>
      {/* User info - Top Left */}
      <div className="absolute top-4 left-4 flex items-center space-x-3 p-2 px-4 sm:p-4 sm:px-8 backdrop-blur-2xl rounded bg-black/50">
        <img
          src={viewStory.user?.profilePics}
          alt=""
          className="size-7 sm:size-8 rounded-full object-cover border border-white"
        />
        <div className="text-white font-medium flex items-center gap-1.5">
          <span>{viewStory.user?.fullname}</span>
          <BadgeCheck size={18} />
        </div>
        {isOwnStory && (
          <button
            onClick={handleStoryDelete}
            className="ml-4 p-2 bg-red-600 cursor-pointer rounded-full hover:bg-red-700 transition"
          >
            <Trash2Icon className="w-5 h-5 text-white" />
          </button>
        )}
      </div>
      {/* Close Button */}
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 text-white text-3xl font-bold focus:outline-none"
      >
        <X className="w-8 h-8 hover:scale-110 transition cursor-pointer" />
      </button>

      {/* Content Wrapper */}
      <div className="max-w-[90vw] max-h-[90vh] flex items-center justify-center">{renderContent()}</div>
    </div>
  );
};

export default StoryViewer;