import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'node:path';

const clientDistPath = path.resolve('client/dist');
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for simplicity, restrict in production
        methods: ["GET", "POST"]
    }
});

/* ─── WebSockets ───────────────────────────────────── */
io.on('connection', (socket) => {
    console.log('a user connected:', socket.id);
    // Add Planning Taki socket logic here...
    socket.on('disconnect', () => { console.log('user disconnected:', socket.id); });
});

/* ── static & SPA fallback ─────────────────────────── */

// Serve static files FIRST
app.use(express.static(clientDistPath));

// API routes should be defined *before* the SPA fallback
// Example: app.get('/api/session', (req, res) => { /* ... */ });

// SPA fallback: Send 'index.html' for non-file, non-API requests
// Remove the explicit check for /socket.io
app.get('*', (req, res) => {
    // Check if it's likely an API request or a file request missed by static middleware
    if (req.path.startsWith('/api/') || path.extname(req.path)) {
        // If it looks like an API call or a file, but wasn't handled, send 404
         if (!res.headersSent) {
             console.log(`Sending 404 for non-SPA path: ${req.path}`);
             res.status(404).send('Not Found');
         }
    } else {
        // Otherwise, assume it's an SPA route and send index.html
        const indexPath = path.join(clientDistPath, 'index.html');
        console.log(`Attempting to send SPA fallback: ${indexPath}`);
        res.sendFile(indexPath, (err) => {
            if (err) {
                console.error(`Error sending index.html from ${indexPath}:`, err);
                 if (!res.headersSent) {
                    if (err.code === 'ENOENT') {
                        res.status(404).send(`Not Found - ${indexPath} missing`);
                    } else {
                        res.status(500).send("Internal Server Error");
                    }
                 }
            }
        });
    }
});


/* ─── Server Start (Vercel uses the export) ────────── */
// No server.listen() here for Vercel deployment

// Export the http.Server instance instead of the Express app
export default server;