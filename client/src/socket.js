import { io } from 'socket.io-client';

// Use the current browser origin for deployed environments, fallback for local dev
const URL = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
const socket = io(URL, { autoConnect: false });

export default socket;