import { io} from "socket.io-client";

const SOCKET_URL = "http://localhost:5000";
// const SOCKET_URL = "https://sanjal-chakra.onrender.com";

export const socket = io(SOCKET_URL, {
    autoConnect: false,
});