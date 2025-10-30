import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Bell,
  Heart,
  MessageCircle,
  UserPlus,
  ThumbsUp,
  CheckCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import useAuth from "../hooks/useAuth";
import API from "../api/api";
import { socket } from "../utils/socket";

const iconMap = {
  follow: <UserPlus className="w-5 h-5 text-blue-500" />,
  like: <Heart className="w-5 h-5 text-pink-500" />,
  comment: <MessageCircle className="w-5 h-5 text-green-500" />,
  message: <MessageCircle className="w-5 h-5 text-indigo-500" />,
  connect: <ThumbsUp className="w-5 h-5 text-yellow-500" />,
};

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const userId = user?._id;

  // ✅ Fetch existing notifications
  const fetchNotifications = async () => {
    try {
      const res = await API.get(`/notify/${userId}`, { withCredentials: true });
      setNotifications(res.data.data);
    } catch (err) {
      console.error("Error fetching notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Mark a single notification as read
  const markAsRead = async (id) => {
    try {
      await API.put(`/notify/read/${id}`, {}, { withCredentials: true });
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  // ✅ Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      const unread = notifications.filter((n) => !n.read);
      await Promise.all(
        unread.map((n) =>
          API.put(`/notify/read/${n._id}`, {}, { withCredentials: true })
        )
      );
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error("Error marking all as read:", err);
    }
  };

  // ✅ Real-time socket listener
  useEffect(() => {
    if (!userId) return;

    socket.connect();
    socket.emit("register", userId);

    fetchNotifications();

    socket.on("receive-notification", (newNoti) => {
      console.log("🔔 New notification received:", newNoti);
      setNotifications((prev) => [newNoti, ...prev]);
      toast.success(`🔔 ${newNoti.message}`);
    });

    return () => {
      socket.off("receive-notification");
      socket.disconnect();
    };
  }, [userId]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex justify-center py-10 px-4">
      <div className="w-full max-w-4xl bg-white shadow-lg rounded-2xl border border-slate-200/70 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <Bell className="w-7 h-7 text-blue-600" />
            Notifications
          </h1>
          <button
            onClick={markAllAsRead}
            className="text-sm text-blue-600 hover:underline hover:text-blue-700"
          >
            Mark all as read
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-16 text-slate-500 animate-pulse">
            Loading notifications...
          </div>
        )}

        {/* Notification List */}
        {!loading && notifications.length > 0 && (
          <div
            className="rounded-xl border border-slate-200/70 bg-white overflow-y-auto 
                       max-h-[70vh] shadow-inner scroll-smooth 
                       scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100"
          >
            <AnimatePresence>
              {notifications.map((noti) => (
                <motion.div
                  key={noti._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className={clsx(
                    "relative flex items-start gap-4 p-5 border-b border-slate-100 hover:bg-slate-50 transition-all duration-200",
                    !noti.read && "bg-blue-50/40"
                  )}
                >
                  {/* New Badge Pulse */}
                  {!noti.read && (
                    <span className="absolute top-4 left-2 w-2.5 h-2.5 bg-blue-500 rounded-full animate-ping" />
                  )}
                  {!noti.read && (
                    <span className="absolute top-4 left-2 w-2.5 h-2.5 bg-blue-500 rounded-full" />
                  )}

                  <div className="flex-shrink-0 mt-1 ml-4">
                    {iconMap[noti.type] || (
                      <Bell className="w-5 h-5 text-gray-400" />
                    )}
                  </div>

                  <div className="flex-1">
                    <p className="text-slate-800 text-sm sm:text-base font-medium leading-relaxed">
                      {noti.message}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(noti.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex-shrink-0">
                    {!noti.read ? (
                      <button
                        onClick={() => markAsRead(noti._id)}
                        className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      >
                        <CheckCircle className="w-4 h-4" /> Mark as read
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Read</span>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Empty State */}
        {!loading && notifications.length === 0 && (
          <div className="text-center py-16 text-slate-500">
            No notifications yet ✨
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
