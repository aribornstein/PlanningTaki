import { io } from 'socket.io-client';

// Connect to the server URL the page was loaded from
// Remove any hardcoded 'http://localhost:3000'
const socket = io();

// OR explicitly use the current origin:
// const socket = io(window.location.origin);

// Handle connection events (optional but recommended)
socket.on('connect', () => {
  console.log('Socket connected:', socket.id);
});

socket.on('connect_error', (err) => {
  console.error('Socket connection error:', err);
});

socket.on('disconnect', (reason) => {
  console.log('Socket disconnected:', reason);
});


export default socket;