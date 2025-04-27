import { defineStore } from 'pinia';
import socket from './socket';

export const useSession = defineStore('session', {
  // Add socketId to the state
  state: () => ({ me: null, session: null, socketId: null }),
  actions: {
    join(name, budget, sessionId) {
      // Ensure socket is connected or initiate connection if needed
      if (!socket.connected) {
        socket.connect(); // Connect if not already connected
      }

      // Store the socket ID once connected
      socket.on('connect', () => {
        console.log('Socket connected with ID:', socket.id);
        this.socketId = socket.id; // Store the socket ID

        // Emit join event *after* connection and ID is known
        socket.emit('join', { sessionId, name, budget });

        // Clear previous listener to avoid duplicates if rejoining
        socket.off('state');
        // Set up the state listener
        socket.on('state', s => {
          console.log('Received state:', s); // Add logging
          this.session = s;
        });

        // Handle disconnects if necessary
        socket.off('disconnect');
        socket.on('disconnect', (reason) => {
          console.log('Socket disconnected:', reason);
          this.session = null; // Clear session on disconnect
          this.socketId = null;
          // Optionally add logic for reconnection attempts or notifying user
        });

      });

      // Handle connection errors
      socket.on('connect_error', (err) => {
        console.error('Socket connection error:', err);
        // Optionally notify the user
      });

      this.me = { name, budget }; // Store basic user info immediately
    },
    // Update addTask signature to only accept title
    addTask(title) { if (this.session) socket.emit('addTask', title); },
    selectTask(id) { if (this.session) socket.emit('selectTask', id); },
    doneExplain() { if (this.session) socket.emit('doneExplain'); },
    vote(v) { if (this.session) socket.emit('vote', v); },
    proposeRepr() { if (this.session) socket.emit('proposeRepr'); },
    reprBallot(c) { if (this.session) socket.emit('reprBallot', c); },
    accept() { if (this.session) socket.emit('accept'); },
    dispute() { if (this.session) socket.emit('dispute'); },
    revote() { if (this.session) socket.emit('revote'); },
    // Add actions for reprioritization adjustment phase
    proposeTaskRemoval(taskId) { if (this.session) socket.emit('proposeTaskRemoval', taskId); },
    doneRepr() { if (this.session) socket.emit('doneRepr'); },
    confirmTaskRemoval() { if (this.session) socket.emit('confirmTaskRemoval'); },
    cancelReprioritization() { if (this.session) socket.emit('cancelReprioritization'); }
  }
});