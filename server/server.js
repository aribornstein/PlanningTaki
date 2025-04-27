import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'node:path';

console.log(">>> [Vercel Function] SERVER SCRIPT STARTED <<<"); // Very early log

const clientDistPath = path.resolve('client/dist');
console.log(`>>> [Vercel Function] Client dist path resolved to: ${clientDistPath}`);

const app = express();
console.log(">>> [Vercel Function] Express app created <<<");

const server = http.createServer(app);
console.log(">>> [Vercel Function] HTTP server created <<<");

// Initialize Socket.IO with the http server instance
const io = new Server(server, {
  transports: ['websocket'],        // ← force WS only
  cors: { origin: '*', methods: ['GET','POST'] }
});
console.log(">>> [Vercel Function] Socket.IO server created <<<");


// --- Add Socket.IO Server Error Logging ---
io.engine.on("connection_error", (err) => {
  console.error(">>> [Vercel Function] SOCKET.IO ENGINE CONNECTION ERROR:", err);
});
io.on('error', (err) => {
    console.error(">>> [Vercel Function] SOCKET.IO SERVER INSTANCE ERROR:", err);
});
// --- End Socket.IO Server Error Logging ---


/* ── in‑memory model & helpers ──────── */
console.log(">>> [Vercel Function] Defining model and helpers <<<");
const fibonacci = [1, 2, 3, 5, 8, 13, 21];
const sessions = {};
function createSession(id) { /* ... as before ... */
    return sessions[id] = {
        id, phase: 'lobby', players: {}, tasks: [], currentTask: null,
        reprVote: null, timer: null, taskToReprioritizeId: null
    };
}
function broadcast(id) { /* ... as before ... */
    if (sessions[id]) {
        io.to(id).emit('state', sessions[id]);
        console.log(`Broadcasting state for session ${id}`);
    } else {
        console.warn(`Attempted to broadcast to non-existent session: ${id}`);
    }
}
function every(obj, fn) { /* ... as before ... */ return Object.values(obj).every(fn); }
function getSession(socket, currentSession, eventName) { /* ... as before ... */
    if (!currentSession || !sessions[currentSession]) {
        console.error(`Error: Event '${eventName}' received for unknown/invalid session '${currentSession}' from socket ${socket.id}`);
        return null;
    }
    return sessions[currentSession];
}


/* ── socket.io endpoints ──────────────── */
console.log(">>> [Vercel Function] Setting up io.on('connection') <<<");
io.on('connection', socket => {
    console.log(`>>> [Vercel Function] Socket connected: ${socket.id}`);
    socket.on('error', (err) => {
        console.error(`>>> [Vercel Function] SOCKET INSTANCE ERROR (Socket ID: ${socket.id}):`, err);
    });

    let currentSession;
    // --- PASTE ALL GAME LOGIC HANDLERS HERE ---
    // ('join', 'addTask', 'selectTask', 'vote', 'accept', 'dispute',
    //  'proposeRepr', 'reprBallot', 'proposeTaskRemoval', 'doneRepr',
    //  'confirmTaskRemoval', 'cancelReprioritization', 'revote', 'disconnect')
    // Example:
    socket.on('join', ({ sessionId, name, budget }) => {
        if (!sessionId || !name || typeof budget !== 'number') {
            console.error(`Invalid join data from ${socket.id}:`, { sessionId, name, budget });
            // Optionally emit error to client: socket.emit('joinError', 'Invalid join data');
            return;
        }
        // Use provided sessionId directly, don't rely on potentially stale currentSession
        const s = sessions[sessionId] ?? createSession(sessionId);
        s.players[socket.id] = {
            id: socket.id, name, budget,
            remaining: budget, vote: null, disputes: 2
        };
        socket.join(sessionId);
        currentSession = sessionId; // Set currentSession *after* successful join/creation
        console.log(`Socket ${socket.id} (${name}) joined session ${currentSession}`);
        broadcast(currentSession);
    });

    socket.on('addTask', (titleString) => { // Renamed parameter to reflect it's just the title
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
        s.tasks.push({
            id: Date.now().toString(),
            title: titleString.trim(),
            owner: socket.id, // Set owner to the creator
            points: null,
            status: 'pending' // Add a status
        });
        broadcast(currentSession);
    });

    socket.on('selectTask', taskId => {
        const s = getSession(socket, currentSession, 'selectTask');
        if (!s) return;

        const task = s.tasks.find(t => t.id === taskId);
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
        s.phase = 'explain';
        s.timer = Date.now() + 120000;                       // 2 min timer start
        s.reprVote = null; // Clear any previous reprioritization vote state
        broadcast(currentSession);
    });

    socket.on('doneExplain', () => {
        const s = getSession(socket, currentSession, 'doneExplain');
        if (!s) return;

        // Only the owner can finish explaining early
        if (s.phase === 'explain' && s.currentTask?.owner === socket.id) {
            s.phase = 'vote';
            s.timer = null; // Clear timer
            broadcast(currentSession);
        }
    });

    socket.on('vote', v => {
        const s = getSession(socket, currentSession, 'vote');
        if (!s) return;

        const p = s.players[socket.id];
        const t = s.currentTask;

        // Validate phase, vote value, and player existence
        if (s.phase !== 'vote' || !fibonacci.includes(v) || !p || !t) {
            console.warn(`Invalid vote attempt in session ${currentSession} phase ${s.phase} by ${socket.id} with vote ${v}`);
            return;
        }
        // Check owner exists before checking remaining points
        const owner = s.players[t.owner];
        if (!owner) {
            console.error(`Owner ${t.owner} not found for task ${t.id} in session ${currentSession}`);
            return; // Or handle appropriately
        }
        if (v > owner.remaining) { // Check against owner's remaining points
            console.warn(`Vote ${v} exceeds owner ${owner.name}'s remaining points (${owner.remaining})`);
            // Optionally notify client: socket.emit('voteError', 'Vote exceeds owner capacity');
            return;
        }

        p.vote = v;

        // Check if everyone has voted
        if (every(s.players, x => x.vote !== null)) {
            s.phase = 'reveal';
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

    socket.on('proposeRepr', () => {
        const s = getSession(socket, currentSession, 'proposeRepr');
        if (!s || s.phase !== 'vote') return; // Can only propose during vote phase

        // Check if player has already voted - cannot propose after voting
        if (s.players[socket.id]?.vote !== null) {
            console.warn(`Player ${socket.id} tried to propose reprioritization after voting.`);
            return;
        }

        s.reprVote = { yes: 0, no: 0, voters: {} }; // Track who voted yes/no
        s.phase = 'reprVote';
        broadcast(currentSession);
    });

    socket.on('reprBallot', choice => {
        const s = getSession(socket, currentSession, 'reprBallot');
        if (!s || s.phase !== 'reprVote' || !s.reprVote) return; // Check phase and reprVote object

        // Prevent voting twice
        if (s.reprVote.voters[socket.id]) {
            console.warn(`Player ${socket.id} tried to vote twice on reprioritization.`);
            return;
        }

        if (choice === 'yes') s.reprVote.yes++;
        else if (choice === 'no') s.reprVote.no++;
        else return; // Invalid choice

        s.reprVote.voters[socket.id] = choice; // Record vote

        // Check if all players have voted on reprioritization
        if (Object.keys(s.reprVote.voters).length === Object.keys(s.players).length) {
            if (s.reprVote.yes > s.reprVote.no) {
                s.phase = 'repr'; // Go to adjustment phase
                // Clear timer from previous phase if any
                s.timer = null;
            } else {
                s.phase = 'vote'; // Go back to voting
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
        taskToRemove.status = 'pending'; // Reset status
        // taskToRemove.owner = null; // Decide if owner should be cleared too

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


    socket.on('accept', () => {
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
            // Mark as Remaining Work instead of blocking
            t.status = 'remaining_work';
            t.points = null; // Clear points as it wasn't budgeted
            console.log(`Task ${t.title} marked as Remaining Work for owner ${owner.name}.`);
            // socket.emit('acceptError', 'Insufficient points remaining. Task marked as Remaining Work.'); // Notify client

            // Reset state for next task (like successful accept but without point deduction)
            Object.values(s.players).forEach(p => p.vote = null); // Reset votes
            s.phase = 'lobby'; // Go back to lobby/task selection
            s.currentTask = null;
            s.timer = null;
            s.reprVote = null;
            broadcast(currentSession);
            return; // Stop further processing for this task
        }


        owner.remaining -= t.points;
        t.status = 'budgeted'; // Mark task as budgeted

        // Reset state for next task
        Object.values(s.players).forEach(p => p.vote = null); // Reset votes
        s.phase = 'lobby'; // Go back to lobby/task selection
        s.currentTask = null;
        s.timer = null;
        s.reprVote = null;
        broadcast(currentSession);
    });

    socket.on('dispute', () => {
        const s = getSession(socket, currentSession, 'dispute');
        if (!s || s.phase !== 'reveal' || !s.currentTask || s.currentTask.owner !== socket.id) return; // Only owner in reveal phase

        const owner = s.players[s.currentTask.owner];
        if (!owner) {
            console.error(`Owner ${s.currentTask.owner} not found during dispute`);
            return;
        }
        if (owner.disputes <= 0) {
            console.warn(`Owner ${owner.name} has no disputes left.`);
            // Optionally notify client: socket.emit('disputeError', 'No disputes remaining');
            return;
        }

        owner.disputes--;
        s.phase = 'discuss';
        s.timer = Date.now() + 60000; // 1 min timer start
        broadcast(currentSession);
    });

    socket.on('revote', () => {
        const s = getSession(socket, currentSession, 'revote');
        // Only owner can trigger revote from discussion phase
        if (!s || s.phase !== 'discuss' || !s.currentTask || s.currentTask.owner !== socket.id) return;

        // Reset votes before going back to vote phase
        Object.values(s.players).forEach(p => p.vote = null);
        s.phase = 'vote';
        s.timer = null; // Clear timer
        broadcast(currentSession);
    });

    socket.on('disconnect', (reason) => {
        console.log(`Socket ${socket.id} disconnected. Reason: ${reason}`);
        // currentSession might be null/undefined if disconnect happens before join completes
        if (!currentSession || !sessions[currentSession]) {
            console.log(`Socket ${socket.id} disconnected without a valid session.`);
            return;
        }

        const s = sessions[currentSession];
        const disconnectedPlayer = s.players[socket.id];
        const disconnectedPlayerName = disconnectedPlayer?.name || 'Unknown Player';

        if (!disconnectedPlayer) {
             console.log(`Socket ${socket.id} disconnected, but player data not found in session ${currentSession}.`);
             return; // Player already removed or never fully joined?
        }

        // Return points for tasks owned by the disconnected player that were budgeted
        s.tasks.forEach(task => {
            if (task.owner === socket.id && task.status === 'budgeted' && task.points != null) {
                console.log(`Returning ${task.points} points for task "${task.title}" as owner ${disconnectedPlayerName} disconnected.`);
                // No need to add back to 'remaining' as the player is gone.
                // Reset task status
                task.status = 'pending';
                task.points = null;
                // Optionally clear owner or mark as needing new owner
                // task.owner = null;
            }
        });


        delete s.players[socket.id]; // Remove player

        console.log(`${disconnectedPlayerName} left session ${currentSession}`);

        // Check if session is now empty
        if (Object.keys(s.players).length === 0) {
            console.log(`Session ${currentSession} is empty, deleting.`);
            delete sessions[currentSession];
        } else {
            // Handle cases where the disconnected player was the owner of the current task
            if (s.currentTask && s.currentTask.owner === socket.id) {
                console.log(`Owner disconnected during task ${s.currentTask.title}. Resetting task and returning to lobby.`);
                // Reset task state
                s.currentTask.status = 'pending'; // Reset status
                s.currentTask.points = null;
                // s.currentTask.owner = null; // Clear owner? Or leave it?

                // Reset session phase
                s.phase = 'lobby'; // Go back to lobby
                s.currentTask = null;
                s.timer = null;
                s.reprVote = null;
                Object.values(s.players).forEach(p => p.vote = null); // Clear votes
            }
            // Add similar checks if disconnect happens during other critical phases (e.g., reprVote, reprDiscuss)
            else if (s.phase === 'reprVote' || s.phase === 'reprDiscuss' || s.phase === 'repr') {
                 console.log(`Player disconnected during reprioritization phase. Resetting to lobby.`);
                 s.phase = 'lobby';
                 s.currentTask = null; // Clear task if it was the one being discussed/repr'd
                 s.timer = null;
                 s.reprVote = null;
                 s.taskToReprioritizeId = null;
                 Object.values(s.players).forEach(p => p.vote = null); // Clear votes
            }


            // Notify remaining players
            broadcast(currentSession);
        }
        // Clear currentSession for the disconnected socket instance? Not strictly necessary
        // as the socket object itself is likely garbage collected.
    });
});


// ── static files ─────────────────────────────────────
console.log(">>> [Vercel Function] Setting up static files middleware <<<");
app.use(express.static(clientDistPath));

// ── SPA fallback ─────────────────────────────────────
console.log(">>> [Vercel Function] Setting up SPA fallback route <<<");
app.get(/^\/(?!socket\.io)(?!.*\.\w+($|\?)).*$/, (req, res, next) => {
    if (path.extname(req.path)) {
       console.warn(`Fallback caught potential static file request: ${req.path}`);
       return next();
    }

    // Serve index.html from the nested /var/task/client/dist directory
    const indexPath = path.join(clientDistPath, 'index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            console.error(`Error sending index.html from ${indexPath}:`, err);
            if (!res.headersSent) {
                if (err.code === 'ENOENT') {
                     // If this happens AGAIN, something is fundamentally wrong with includeFiles
                     res.status(404).send(`SPA Fallback Error: ${err.message}. File not found even at ${indexPath}. Check Vercel includeFiles behavior.`);
                } else {
                     res.status(500).send("Internal Server Error");
                }
            }
        }
    });
});

// Optional: Add a final 404 handler
console.log(">>> [Vercel Function] Setting up final 404 handler <<<");
app.use((req, res) => {
    if (!res.headersSent) {
      console.log(`Final 404 handler reached for path: ${req.path}`);
      res.status(404).send('Not Found');
    }
});


// --- Add HTTP Server Upgrade Error Logging ---
console.log(">>> [Vercel Function] Setting up HTTP server listeners ('upgrade', 'error') <<<");
server.on('upgrade', (req, socket, head) => {
  console.log(`>>> [Vercel Function] HTTP server received upgrade request for: ${req.url}`);
});
server.on('error', (err) => {
    console.error(">>> [Vercel Function] HTTP SERVER ERROR:", err);
});
// --- End HTTP Server Upgrade Error Logging ---


/* ─── Server Start (Vercel uses the export) ────────── */
console.log(">>> [Vercel Function] Exporting server instance <<<");
export default server;