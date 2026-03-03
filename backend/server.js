const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { exec } = require('child_process');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const state = { messages: [], canvasData: null };

app.use(express.json({ limit: '10mb' }));

app.post('/api/authenticate', (req, res) => {
    const clientIp = req.ip.replace('::ffff:', ''); 
    exec(`sudo ndsctl auth ${clientIp}`, (error) => {
        if (error) {
            console.error(`[AUTH] Error for ${clientIp}: ${error}`);
            return res.status(500).json({ status: 'error', message: 'Auth failed' });
        }
        console.log(`[AUTH] Access granted to IP ${clientIp}.`);
        res.json({ status: 'connected' });
    });
});

app.get('/api/messages', (req, res) => res.json(state.messages.slice(-50)));
app.get('/api/canvas', (req, res) => res.json({ data: state.canvasData }));
app.get('/health', (req, res) => res.json({ status: 'ok', clients: io.engine.clientsCount }));

io.on('connection', (socket) => {
    socket.emit('init', { messages: state.messages.slice(-50), canvasData: state.canvasData });
    
    socket.on('chat:message', (message) => {
        state.messages.push(message);
        if (state.messages.length > 100) state.messages = state.messages.slice(-100);
        io.emit('chat:message', message);
    });
    
    socket.on('canvas:update', (data) => {
        state.canvasData = data;
        socket.broadcast.emit('canvas:update', data);
    });
    
    socket.on('canvas:clear', () => {
        state.canvasData = null;
        io.emit('canvas:clear');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Backend running on port ${PORT}`));
