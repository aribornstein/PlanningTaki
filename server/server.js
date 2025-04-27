import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'node:path';

// The static files are copied by Vercel to the root of the serverless function's execution context.
// path.resolve('.') points to this root directory (e.g., /var/task).
const staticFilesRoot = path.resolve('.');

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

    socket.on('disconnect',()=>{
        console.log('user disconnected:',socket.id);
    });

    // Example: Echo message back to sender
    socket.on('chat message',(msg)=>{
        console.log('message from',socket.id,': '+msg);
        socket.emit('chat message',`Server received: ${msg}`);
    });
});

/* ── static & SPA fallback ─────────────────────────── */
// Serve static files directly from the function's root directory
app.use(express.static(staticFilesRoot));

// Handle SPA routing (send index.html for any request that doesn't match static files)
app.get('*',(req,res)=>{
    // Check if the request looks like a file request (e.g., has an extension)
    // Allow specific known files like vite.svg if needed
    if (path.extname(req.path).length > 0 && req.path !== '/vite.svg') {
        // If it looks like a file but wasn't found by express.static, send 404
        res.status(404).end();
    } else {
        // Otherwise, assume it's an SPA route and send index.html from the root
        res.sendFile(path.join(staticFilesRoot,'index.html'),(err)=>{
            if (err) {
                // Log the error for debugging on Vercel
                console.error(`Error sending index.html from ${staticFilesRoot}:`,err);
                res.status(500).send("Internal Server Error - Could not send index.html");
            }
        });
    }
});


/* ─── Server Start ─────────────────────────────────── */
const PORT = process.env.PORT || 3000;
server.listen(PORT,()=>{
    console.log(`Server listening on port ${PORT}`);
    console.log(`Serving static files from: ${staticFilesRoot}`); // Log the path being used
});

export default app; // Export the app for Vercel