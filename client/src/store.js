import { defineStore } from 'pinia';
import socket from './socket';

export const useSession = defineStore('session', {
  // Add socketId to the state
  state: () => ({ me: null, session: null, socketId: null, error: null, isConnected: false }), // Added error and isConnected to state
  actions: {
    async join(sessionId, name, budget) {
      console.log('store.js: Joining session with ID:', sessionId); // Add log
      // Use 'this' instead of 'state' to access state properties
      this.sessionId = sessionId; // Corrected: Use 'this'
      this.playerName = name;     // Corrected: Use 'this' (Assuming you want to store these, though they aren't defined in state)
      this.playerBudget = budget; // Corrected: Use 'this' (Assuming you want to store these, though they aren't defined in state)
      this.error = null;          // Corrected: Use 'this'
      this.isConnected = false;   // Corrected: Use 'this'

      return new Promise((resolve, reject) => {
        if (!socket || !socket.connected) {
          console.log('store.js: Socket not connected, attempting connection...'); // Add log
          connectSocket().then(() => {
            console.log('store.js: Socket connected, emitting join for session:', sessionId); // Add log
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
              this.isConnected = false; // Update connection status
              this.error = `Disconnected: ${reason}`; // Optionally set error on disconnect
            });

          }).catch(err => {
            console.error('Socket connection error:', err);
            // Optionally notify the user
          });
        } else {
          console.log('store.js: Socket already connected, emitting join for session:', sessionId); // Add log
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
            this.isConnected = false; // Update connection status
            this.error = `Disconnected: ${reason}`; // Optionally set error on disconnect
          });

        }

        // Setup temporary listeners for join success/failure
        const joinSuccessListener = (sessionData) => {
          // Handle successful join
          console.log('Successfully joined session:', sessionData);
          this.session = sessionData;
          this.socketId = socket.id; // Store the socket ID
          this.isConnected = true; // Set connected status
          resolve();
          cleanup();
        };

        const joinErrorListener = (error) => {
          // Handle join error
          console.error('Error joining session:', error);
          this.error = error; // Corrected: Use 'this'
          this.isConnected = false; // Ensure connection status is false on error
          reject(error);
          cleanup();
        };

        const cleanup = () => {
          // Remove temporary listeners
          socket.off('sessionUpdated', joinSuccessListener);
          socket.off('joinError', joinErrorListener);
        };

        socket.once('sessionUpdated', joinSuccessListener);
        socket.once('joinError', joinErrorListener);

        // Emit join after setting up listeners
        if (socket.connected) {
            console.log('store.js: Emitting join for session:', sessionId);
            socket.emit('join', { sessionId, name, budget });
        } else {
            console.log('store.js: Socket not connected, attempting connection first...');
            connectSocket().then(() => {
                console.log('store.js: Socket connected, emitting join for session:', sessionId);
                socket.emit('join', { sessionId, name, budget });
            }).catch(err => {
                console.error('Socket connection error during join:', err);
                this.error = 'Failed to connect to server'; // Set error state
                this.isConnected = false;
                reject(err); // Reject the promise if connection fails
                cleanup(); // Ensure cleanup happens even on connection error
            });
        }

        // Setup permanent listeners (moved inside the promise logic to ensure they are set after connection attempt)
        socket.off('state'); // Clear previous listener
        socket.on('state', s => {
          console.log('Received state:', s);
          this.session = s;
        });

        socket.off('disconnect'); // Clear previous listener
        socket.on('disconnect', (reason) => {
          console.log('Socket disconnected:', reason);
          this.session = null;
          this.socketId = null;
          this.isConnected = false; // Update connection status
          this.error = `Disconnected: ${reason}`; // Optionally set error on disconnect
        });

      });
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
    // Add action for abandoning task
    abandonTask() {
      if (this.session && this.session.phase === 'vote' && this.session.currentTask?.owner === this.socketId) {
         console.log('Emitting abandonTask'); // Client-side log
         socket.emit('abandonTask');
      } else {
         console.warn('Attempted to call abandonTask action in invalid state.');
      }
    },
    // Add actions for reprioritization adjustment phase
    proposeTaskRemoval(taskId) { if (this.session) socket.emit('proposeTaskRemoval', taskId); },
    doneRepr() { if (this.session) socket.emit('doneRepr'); },
    confirmTaskRemoval() { if (this.session) socket.emit('confirmTaskRemoval'); },
    cancelReprioritization() { if (this.session) socket.emit('cancelReprioritization'); }
  }
});

// Helper function to connect socket (assuming it exists or you create it)
async function connectSocket() {
  return new Promise((resolve, reject) => {
    if (socket.connected) {
      resolve();
      return;
    }
    socket.connect();
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
}