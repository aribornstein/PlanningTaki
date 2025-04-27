import { io } from 'socket.io-client';

// connect with WebSocket only – no polling fallback
const socket = io({
  transports: ['websocket'],
  upgrade: false          // skip initial polling probe
});

export default socket;