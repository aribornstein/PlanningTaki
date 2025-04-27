import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'node:path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.join(__dirname, '../client/dist');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

/* ── in‑memory model ───────────────────────────────── */
const fibonacci = [0,1,2,3,5,8,13,21,34];
const sessions  = {};           // id → Session

function createSession(id){ return sessions[id] = {
  id, phase:'lobby', players:{}, tasks:[], currentTask:null,
  reprVote:null, timer: null, taskToReprioritizeId: null // Add taskToReprioritizeId
};}

/* ── helpers ───────────────────────────────────────── */
function broadcast(id){
  if (sessions[id]) { // Check if session exists before broadcasting
    io.to(id).emit('state', sessions[id]);
  } else {
    console.warn(`Attempted to broadcast to non-existent session: ${id}`);
  }
}

function every(obj, fn){ return Object.values(obj).every(fn); }

// Helper to safely get the session and handle errors
function getSession(socket, currentSession, eventName) {
  if (!currentSession || !sessions[currentSession]) {
    console.error(`Error: Event '${eventName}' received for unknown/invalid session '${currentSession}' from socket ${socket.id}`);
    // Optionally emit a specific error back to the client
    // socket.emit('serverError', `Invalid session state for event: ${eventName}`);
    return null; // Indicate failure
  }
  return sessions[currentSession];
}


/* ── socket.io endpoints ───────────────────────────── */
io.on('connection', socket=>{
  let currentSession; // This variable holds the session ID for this specific connection

  console.log(`Socket connected: ${socket.id}`);

  socket.on('join', ({sessionId,name,budget})=>{
    if (!sessionId || !name || typeof budget !== 'number') {
        console.error(`Invalid join data from ${socket.id}:`, { sessionId, name, budget });
        // Optionally emit error to client: socket.emit('joinError', 'Invalid join data');
        return;
    }
    // Use provided sessionId directly, don't rely on potentially stale currentSession
    const s = sessions[sessionId] ?? createSession(sessionId);
    s.players[socket.id] = { id:socket.id, name, budget,
      remaining:budget, vote:null, disputes:2 };
    socket.join(sessionId);
    currentSession = sessionId; // Set currentSession *after* successful join/creation
    console.log(`Socket ${socket.id} (${name}) joined session ${currentSession}`);
    broadcast(currentSession);
  });

  socket.on('addTask', (titleString)=>{ // Renamed parameter to reflect it's just the title
    const s = getSession(socket, currentSession, 'addTask');
    if (!s) return; // Stop if session is invalid

    // Ensure titleString is actually a string
    if (typeof titleString !== 'string' || !titleString.trim()) {
        console.error(`Invalid title received for addTask from ${socket.id}:`, titleString);
        // Optionally emit an error back to the client
        // socket.emit('taskError', 'Invalid task title provided.');
        return;
    }

    // Set owner directly to the creator (socket.id)
    // Remove creatorId as owner now serves this initial purpose
    s.tasks.push({
        id: Date.now().toString(),
        title: titleString.trim(),
        owner: socket.id, // Set owner to the creator
        points: null
    });
    broadcast(currentSession);
  });

  socket.on('selectTask', taskId=>{
    const s = getSession(socket, currentSession, 'selectTask');
    if (!s) return;

    const task = s.tasks.find(t=>t.id===taskId);
    if (!task) {
        console.error(`Task ${taskId} not found in session ${currentSession}`);
        // Optionally emit error: socket.emit('taskError', 'Task not found');
        return;
    }

    // --- Add Check: Only the owner can select the task ---
    if (task.owner !== socket.id) {
        console.warn(`Player ${socket.id} tried to select task ${taskId} owned by ${task.owner}`);
        // Optionally emit error: socket.emit('taskError', 'Only the task owner can start estimation.');
        return;
    }
    // --- End Check ---

    // Reset votes from previous round if any
    Object.values(s.players).forEach(p => p.vote = null);
    s.currentTask = task;
    // s.currentTask.owner = socket.id; // Remove this line - owner is already set
    s.phase='explain';
    s.timer = Date.now()+120000;                       // 2 min timer start
    s.reprVote = null; // Clear any previous reprioritization vote state
    broadcast(currentSession);
  });

  socket.on('doneExplain', ()=>{
    const s = getSession(socket, currentSession, 'doneExplain');
    if (!s) return;

    // Only the owner can finish explaining early
    if(s.phase==='explain' && s.currentTask?.owner === socket.id){
        s.phase='vote';
        s.timer = null; // Clear timer
        broadcast(currentSession);
    }
  });

  socket.on('vote', v=>{
    const s = getSession(socket, currentSession, 'vote');
    if (!s) return;

    const p=s.players[socket.id];
    const t=s.currentTask;

    // Validate phase, vote value, and player existence
    if(s.phase!=='vote' || !fibonacci.includes(v) || !p || !t) {
        console.warn(`Invalid vote attempt in session ${currentSession} phase ${s.phase} by ${socket.id} with vote ${v}`);
        return;
    }
    // Check owner exists before checking remaining points
    const owner = s.players[t.owner];
    if (!owner) {
        console.error(`Owner ${t.owner} not found for task ${t.id} in session ${currentSession}`);
        return; // Or handle appropriately
    }
    if(v > owner.remaining) { // Check against owner's remaining points
        console.warn(`Vote ${v} exceeds owner ${owner.name}'s remaining points (${owner.remaining})`);
        // Optionally notify client: socket.emit('voteError', 'Vote exceeds owner capacity');
        return;
    }

    p.vote=v;

    // Check if everyone has voted
    if(every(s.players, x => x.vote !== null)){
      s.phase='reveal';
      // Calculate estimate based on majority vote, tie-breaking with lower score
      const votes = Object.values(s.players).map(x => x.vote);
      const voteCounts = votes.reduce((acc, vote) => {
        acc[vote] = (acc[vote] || 0) + 1;
        return acc;
      }, {});

      let maxCount = 0;
      let majorityVotes = [];
      for (const vote in voteCounts) {
        if (voteCounts[vote] > maxCount) {
          maxCount = voteCounts[vote];
          majorityVotes = [parseInt(vote)]; // Start new list of majority votes
        } else if (voteCounts[vote] === maxCount) {
          majorityVotes.push(parseInt(vote)); // Add to tied majority votes
        }
      }

      // If there's a tie for majority, pick the lowest score among them
      t.points = Math.min(...majorityVotes);

      broadcast(currentSession);
    } else {
      // Broadcast intermediate state showing who has voted (but not the value yet)
      broadcast(currentSession);
    }
  });

  socket.on('proposeRepr', ()=>{
    const s = getSession(socket, currentSession, 'proposeRepr');
    if (!s || s.phase !== 'vote') return; // Can only propose during vote phase

    // Check if player has already voted - cannot propose after voting
    if (s.players[socket.id]?.vote !== null) {
        console.warn(`Player ${socket.id} tried to propose reprioritization after voting.`);
        return;
    }

    s.reprVote = { yes:0, no:0, voters: {} }; // Track who voted yes/no
    s.phase='reprVote';
    broadcast(currentSession);
  });

  socket.on('reprBallot', choice=>{
    const s = getSession(socket, currentSession, 'reprBallot');
    if (!s || s.phase !== 'reprVote' || !s.reprVote) return; // Check phase and reprVote object

    // Prevent voting twice
    if (s.reprVote.voters[socket.id]) {
        console.warn(`Player ${socket.id} tried to vote twice on reprioritization.`);
        return;
    }

    if(choice==='yes') s.reprVote.yes++;
    else if(choice==='no') s.reprVote.no++;
    else return; // Invalid choice

    s.reprVote.voters[socket.id] = choice; // Record vote

    // Check if all players have voted on reprioritization
    if(Object.keys(s.reprVote.voters).length === Object.keys(s.players).length){
      if(s.reprVote.yes > s.reprVote.no){
          s.phase='repr'; // Go to adjustment phase
          // Clear timer from previous phase if any
          s.timer = null;
      } else {
          s.phase='vote'; // Go back to voting
      }
      s.reprVote = null; // Clear reprioritization vote state
      broadcast(currentSession);
    } else {
      // Broadcast intermediate state if needed
      broadcast(currentSession);
    }
  });

  // Handler for owner proposing a task removal during 'repr' phase
  socket.on('proposeTaskRemoval', (taskIdToRemove) => {
      const s = getSession(socket, currentSession, 'proposeTaskRemoval');
      // Only owner of currentTask in 'repr' phase can trigger this
      if (!s || s.phase !== 'repr' || !s.currentTask || s.currentTask.owner !== socket.id) return;

      const taskToRemove = s.tasks.find(t => t.id === taskIdToRemove);
      const owner = s.players[socket.id];

      // Validate task exists, belongs to owner, and has points assigned
      if (!taskToRemove || taskToRemove.owner !== socket.id || taskToRemove.points == null) {
          console.warn(`Invalid task removal proposal by ${socket.id} for task ${taskIdToRemove}`);
          // Optionally emit error: socket.emit('reprError', 'Invalid task selected for removal.');
          return;
      }

      s.phase = 'reprDiscuss';
      s.taskToReprioritizeId = taskIdToRemove;
      s.timer = Date.now() + 60000; // 1 min discussion timer
      broadcast(currentSession);
  });


  // Handler for owner finishing adjustment without removing a task
  socket.on('doneRepr', () => {
      const s = getSession(socket, currentSession, 'doneRepr');
      // Only owner of currentTask in 'repr' phase can trigger this
      if (!s || s.phase !== 'repr' || !s.currentTask || s.currentTask.owner !== socket.id) return;

      s.phase = 'vote'; // Go back to voting on the current task
      // Ensure votes are reset before revoting
      Object.values(s.players).forEach(p => p.vote = null);
      s.timer = null; // Clear timer
      broadcast(currentSession);
  });

  // Handler for owner confirming task removal after discussion
  socket.on('confirmTaskRemoval', () => {
      const s = getSession(socket, currentSession, 'confirmTaskRemoval');
      // Only owner of currentTask in 'reprDiscuss' phase can trigger this
      if (!s || s.phase !== 'reprDiscuss' || !s.currentTask || s.currentTask.owner !== socket.id || !s.taskToReprioritizeId) return;

      const taskToRemove = s.tasks.find(t => t.id === s.taskToReprioritizeId);
      const owner = s.players[socket.id];

      if (!taskToRemove || !owner) {
          console.error(`Error confirming removal: Task ${s.taskToReprioritizeId} or Owner ${socket.id} not found.`);
          // Potentially reset to a safe state like lobby
          s.phase = 'lobby';
          s.currentTask = null;
          s.timer = null;
          s.taskToReprioritizeId = null;
          broadcast(currentSession);
          return;
      }

      // Add points back to owner
      owner.remaining += taskToRemove.points;
      // Mark task as removed/reset (clear points and potentially owner)
      taskToRemove.points = null;
      // taskToRemove.owner = null; // Decide if owner should be cleared too
      // Optionally add a status: taskToRemove.status = 'removed';

      console.log(`Task ${taskToRemove.title} removed by ${owner.name}. Points ${taskToRemove.points} returned.`);

      // Reset state for voting on the original currentTask
      Object.values(s.players).forEach(p => p.vote = null);
      s.phase = 'vote';
      s.timer = null;
      s.taskToReprioritizeId = null;
      broadcast(currentSession);
  });

  // Handler for owner cancelling reprioritization and abandoning current task
  socket.on('cancelReprioritization', () => {
      const s = getSession(socket, currentSession, 'cancelReprioritization');
       // Only owner of currentTask in 'reprDiscuss' phase can trigger this
      if (!s || s.phase !== 'reprDiscuss' || !s.currentTask || s.currentTask.owner !== socket.id) return;

      const abandonedTask = s.currentTask;
      console.log(`Reprioritization cancelled by owner. Task ${abandonedTask.title} abandoned.`);

      // Mark current task as abandoned (e.g., set points to -1 or add status)
      // abandonedTask.points = -1; // Example: Mark as abandoned
      abandonedTask.status = 'abandoned'; // Add a status field if preferred

      // Reset state back to lobby
      s.phase = 'lobby';
      s.currentTask = null;
      s.timer = null;
      s.taskToReprioritizeId = null;
      Object.values(s.players).forEach(p => p.vote = null); // Clear any lingering votes
      broadcast(currentSession);
  });


  socket.on('accept', ()=>{
    const s = getSession(socket, currentSession, 'accept');
    if (!s || s.phase !== 'reveal' || !s.currentTask || s.currentTask.owner !== socket.id) return; // Only owner in reveal phase

    const t = s.currentTask;
    const owner = s.players[t.owner];

    if (!owner) {
        console.error(`Owner ${t.owner} not found during accept for task ${t.id}`);
        return;
    }
    // Check if owner has enough points AFTER this task
    if (owner.remaining < t.points) {
        console.warn(`Owner ${owner.name} cannot accept task ${t.title} (${t.points} pts) with only ${owner.remaining} pts remaining.`);
        // TODO: Implement "Remaining Work" logic here - mark task, move to next sprint?
        // For now, just prevent acceptance and maybe reset phase?
        // Or potentially trigger reprioritization automatically? Needs design decision.
        // Let's just block it for now:
        // socket.emit('acceptError', 'Cannot accept, insufficient points remaining.');
        return; // Block acceptance
    }


    owner.remaining -= t.points;

    // Reset state for next task
    Object.values(s.players).forEach(p=>p.vote=null); // Reset votes
    s.phase='lobby'; // Go back to lobby/task selection
    s.currentTask=null;
    s.timer = null;
    s.reprVote = null;
    broadcast(currentSession);
  });

  socket.on('dispute', ()=>{
    const s = getSession(socket, currentSession, 'dispute');
     if (!s || s.phase !== 'reveal' || !s.currentTask || s.currentTask.owner !== socket.id) return; // Only owner in reveal phase

    const owner=s.players[s.currentTask.owner];
    if (!owner) {
        console.error(`Owner ${s.currentTask.owner} not found during dispute`);
        return;
    }
    if(owner.disputes <= 0) {
        console.warn(`Owner ${owner.name} has no disputes left.`);
        // Optionally notify client: socket.emit('disputeError', 'No disputes remaining');
        return;
    }

    owner.disputes--;
    s.phase='discuss';
    s.timer=Date.now()+60000; // 1 min timer start
    broadcast(currentSession);
  });

  socket.on('revote', ()=>{
    const s = getSession(socket, currentSession, 'revote');
    // Only owner can trigger revote from discussion phase
    if (!s || s.phase !== 'discuss' || !s.currentTask || s.currentTask.owner !== socket.id) return;

    // Reset votes before going back to vote phase
    Object.values(s.players).forEach(p => p.vote = null);
    s.phase='vote';
    s.timer = null; // Clear timer
    broadcast(currentSession);
  });

  socket.on('disconnect', (reason)=>{
    console.log(`Socket ${socket.id} disconnected. Reason: ${reason}`);
    // currentSession might be null/undefined if disconnect happens before join completes
    if(!currentSession || !sessions[currentSession]) {
        console.log(`Socket ${socket.id} disconnected without a valid session.`);
        return;
    }

    const s=sessions[currentSession];
    const disconnectedPlayerName = s.players[socket.id]?.name || 'Unknown Player';
    delete s.players[socket.id]; // Remove player

    console.log(`${disconnectedPlayerName} left session ${currentSession}`);

    // Check if session is now empty
    if(Object.keys(s.players).length === 0) {
      console.log(`Session ${currentSession} is empty, deleting.`);
      delete sessions[currentSession];
    } else {
      // Handle cases where the disconnected player was the owner of the current task
      if (s.currentTask && s.currentTask.owner === socket.id) {
          console.log(`Owner disconnected during task ${s.currentTask.title}. Resetting task.`);
          // Reset task state, return to lobby or task selection
          s.currentTask.owner = null; // Clear owner
          s.currentTask.points = null;
          // Optionally remove the task or mark it as needing a new owner
          s.phase = 'lobby'; // Go back to lobby
          s.currentTask = null;
          s.timer = null;
          s.reprVote = null;
          Object.values(s.players).forEach(p => p.vote = null); // Clear votes
      }
      // Add similar checks if disconnect happens during other critical phases (e.g., reprVote)

      // Notify remaining players
      broadcast(currentSession);
    }
    // Clear currentSession for the disconnected socket instance? Not strictly necessary
    // as the socket object itself is likely garbage collected.
  });
});

/* ── static & SPA fallback ─────────────────────────── */
// Serve static files from the client build directory
app.use(express.static(clientDist));

// Handle SPA routing (send index.html for any request that doesn't match static files)
app.get('*',(req,res)=>{
    // Check if the request looks like a file request (e.g., has an extension)
    if (path.extname(req.path).length > 0) {
        // If it looks like a file but wasn't found by express.static, send 404
        res.status(404).end();
    } else {
        // Otherwise, assume it's an SPA route and send index.html
        res.sendFile(path.join(clientDist,'index.html'));
    }
});


const port=process.env.PORT||3000;
server.listen(port,()=>console.log(`Server ready on http://localhost:${port}`));