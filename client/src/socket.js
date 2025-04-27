import { io } from 'socket.io-client';

const URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000'; // Use env var with fallback
const socket = io(URL, { autoConnect: false });

export default socket;