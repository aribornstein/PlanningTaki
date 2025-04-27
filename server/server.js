import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'node:path';

// Adjust path assuming files are in a nested client/dist directory within /var/task
const clientDistPath = path.resolve('client/dist'); // Should resolve to /var/task/client/dist

const app    = express();
const server = http.createServer(app);
const io     = new Server(server,{
    cors: {
        origin: "*", // Allow all origins for simplicity, restrict in production
        methods: ["GET","POST"]
    }
});

/* ─── WebSockets ───────────────────────────────────── */
io.on('connection',(socket)=>{
    console.log('a user connected:',socket.id);
    // Add Planning Taki socket logic here...
    socket.on('disconnect',()=>{ console.log('user disconnected:',socket.id); });
});

/* ── static & SPA fallback ─────────────────────────── */

// Serve static files from the nested client/dist directory
app.use(express.static(clientDistPath));

// API routes should be defined *before* the SPA fallback
// Example: app.get('/api/session', (req, res) => { /* ... */ });

// SPA fallback: Send 'index.html' for non-file, non-API requests
app.get('*',(req,res)=>{
    // Exclude socket.io path explicitly
    if (req.path.startsWith('/socket.io')) {
        // Let socket.io handle its own requests
        return; // Do nothing more for socket.io paths
    }

    // Check if it looks like an SPA route (no extension or root)
    if (!path.extname(req.path) || req.path === '/') {
         const indexPath = path.join(clientDistPath,'index.html'); // Look inside client/dist
         console.log(`Attempting to send SPA fallback: ${indexPath}`); // Add logging
         res.sendFile(indexPath, (err) => {
             if (err) {
                 console.error(`Error sending index.html from ${indexPath}:`, err);
                 if (err.code === 'ENOENT') {
                     res.status(404).send(`Not Found - ${indexPath} missing`);
                 } else {
                     res.status(500).send("Internal Server Error");
                 }
             }
         });
    } else {
        // If it has an extension but wasn't served by express.static,
        // let it 404. Check if headers already sent.
        if (!res.headersSent) {
             console.log(`Sending 404 for path: ${req.path}`); // Add logging
             res.status(404).send('Not Found');
        }
    }
});


/* ─── Server Start (Vercel uses the export) ────────── */
// No server.listen() here for Vercel deployment

export default app; // Export the Express app for Vercel