/**
 * Captive Portal - Retro Hacking Interface
 * Features: Real-time Chat, Shared Drawing Canvas
 * Backend: Socket.io for shared state across all connected devices
 */

// State management
const state = {
    connectionTime: new Date(),
    particleCount: 15,
    drawing: false,
    canvas: null,
    ctx: null,
    socket: null,
    connected: false,
    accessGranted: false
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

function init() {
    console.log('%c[PORTAL] Initializing...', 'color: #00ff00; font-weight: bold');
    
    displayConnectionTime();
    createParticles();
    setupTabs();
    setupChat();
    setupCanvas();
    connectToBackend();
    
    console.log('%c[PORTAL] Ready', 'color: #00ff00; font-weight: bold');
}

/**
 * BACKEND CONNECTION - Socket.io
 */
function connectToBackend() {
    // Connect to backend server via nginx proxy
    // Use polling first for Mac captive portal compatibility
    state.socket = io({
        transports: ['polling', 'websocket'],
        path: '/socket.io/',
        upgrade: true
    });
    
    state.socket.on('connect', () => {
        console.log('%c[SOCKET] Connected to backend', 'color: #00ff00');
        state.connected = true;
        showNotification('connected to server');
    });
    
    state.socket.on('disconnect', () => {
        console.log('%c[SOCKET] Disconnected from backend', 'color: #ff0000');
        state.connected = false;
        showNotification('disconnected from server');
    });
    
    // Initialize with current state
    state.socket.on('init', (data) => {
        console.log('[SOCKET] Received initial state:', data);
        renderAllChatMessages(data.messages || []);
        if (data.canvasData) {
            loadCanvasData(data.canvasData);
        }
    });
    
    // Real-time chat messages
    state.socket.on('chat:message', (message) => {
        appendChatMessage(message);
    });
    
    // Real-time canvas updates
    state.socket.on('canvas:update', (data) => {
        if (!state.drawing && data) {
            loadCanvasData(data);
        }
    });
    
    state.socket.on('canvas:clear', () => {
        if (state.ctx) {
            state.ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
        }
    });
    
    state.socket.on('connect_error', (error) => {
        console.error('[SOCKET] Connection error:', error);
    });
}

/**
 * CONNECTION TIME
 */
function displayConnectionTime() {
    const el = document.getElementById('connectionTime');
    if (!el) return;
    
    const time = state.connectionTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    el.textContent = time;
}

/**
 * PARTICLES
 */
function createParticles() {
    const container = document.getElementById('particles');
    if (!container) return;

    for (let i = 0; i < state.particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        
        const size = Math.random() * 8 + 2;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.animationDelay = `${Math.random() * 20}s`;
        particle.style.animationDuration = `${15 + Math.random() * 10}s`;
        
        container.appendChild(particle);
    }
}

/**
 * TAB SYSTEM
 */
function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tabName}-tab`);
    });
}

/**
 * CHAT SYSTEM - Real-time with Socket.io
 */
function setupChat() {
    const sendBtn = document.getElementById('sendBtn');
    const messageInput = document.getElementById('messageInput');
    
    if (sendBtn) sendBtn.addEventListener('click', sendMessage);
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }
}

function sendMessage() {
    if (!state.connected) {
        showNotification('not connected to server');
        return;
    }
    
    const nameInput = document.getElementById('nameInput');
    const messageInput = document.getElementById('messageInput');
    
    if (!messageInput || !messageInput.value.trim()) return;
    
    const message = {
        id: Date.now(),
        name: nameInput ? nameInput.value.trim() || 'anonymous' : 'anonymous',
        text: messageInput.value.trim(),
        timestamp: new Date().toISOString()
    };
    
    // Send to backend
    state.socket.emit('chat:message', message);
    
    // Trigger internet access for this user
    grantAccess();
    
    // Clear input
    if (messageInput) messageInput.value = '';
}

/**
 * AUTHENTICATION (Online Pass-through)
 */
function grantAccess() {
    if (state.accessGranted) return;

    console.log('[PORTAL] Requesting internet access...');
    fetch('/api/authenticate', { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'connected') {
                console.log('%c[PORTAL] Internet access granted!', 'color: #00ff00; font-weight: bold');
                state.accessGranted = true;
                showNotification('internet access granted!');
                
                // Add a visual indicator or link
                const footer = document.querySelector('.footer-info');
                if (footer) {
                    const link = document.createElement('a');
                    link.href = "https://www.google.com";
                    link.className = 'access-link';
                    link.textContent = '→ Continue to the internet';
                    link.style.cssText = 'display: block; color: #00ff00; margin-top: 10px; text-decoration: underline;';
                    footer.appendChild(link);
                }
            }
        })
        .catch(err => {
            console.error('[PORTAL] Auth failed:', err);
        });
}

function renderAllChatMessages(messages) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    if (messages.length === 0) {
        container.innerHTML = '<div class="chat-placeholder">No messages yet. Be the first to say hello!</div>';
        return;
    }
    
    container.innerHTML = '';
    messages.slice(-20).forEach(msg => {
        const el = createChatMessageElement(msg);
        container.appendChild(el);
    });
    
    container.scrollTop = container.scrollHeight;
}

function appendChatMessage(message) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    const placeholder = container.querySelector('.chat-placeholder');
    if (placeholder) placeholder.remove();
    
    const el = createChatMessageElement(message);
    container.appendChild(el);
    
    while (container.children.length > 20) {
        container.removeChild(container.firstChild);
    }
    
    container.scrollTop = container.scrollHeight;
}

function createChatMessageElement(message) {
    const div = document.createElement('div');
    div.className = 'chat-message';
    
    const time = new Date(message.timestamp);
    const timeStr = time.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    div.innerHTML = `
        <div class="chat-message-header">
            <span class="chat-message-name">${escapeHtml(message.name)}</span>
            <span class="chat-message-time">${timeStr}</span>
        </div>
        <div class="chat-message-text">${escapeHtml(message.text)}</div>
    `;
    
    return div;
}

/**
 * DRAWING CANVAS SYSTEM
 */
function setupCanvas() {
    state.canvas = document.getElementById('drawCanvas');
    if (!state.canvas) return;
    
    state.ctx = state.canvas.getContext('2d');
    
    state.canvas.width = 600;
    state.canvas.height = 400;
    
    // Drawing events
    state.canvas.addEventListener('mousedown', startDrawing);
    state.canvas.addEventListener('mousemove', draw);
    state.canvas.addEventListener('mouseup', stopDrawing);
    state.canvas.addEventListener('mouseout', stopDrawing);
    
    // Touch events
    state.canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        state.canvas.dispatchEvent(mouseEvent);
    });
    
    state.canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        state.canvas.dispatchEvent(mouseEvent);
    });
    
    state.canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        const mouseEvent = new MouseEvent('mouseup', {});
        state.canvas.dispatchEvent(mouseEvent);
    });
    
    // Clear button
    const clearBtn = document.getElementById('clearCanvas');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearCanvas);
    }
}

function startDrawing(e) {
    state.drawing = true;
    const rect = state.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    state.ctx.beginPath();
    state.ctx.moveTo(x, y);
}

function draw(e) {
    if (!state.drawing) return;
    
    const rect = state.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const color = document.getElementById('colorPicker')?.value || '#00ff00';
    const size = document.getElementById('brushSize')?.value || 3;
    
    state.ctx.lineTo(x, y);
    state.ctx.strokeStyle = color;
    state.ctx.lineWidth = size;
    state.ctx.lineCap = 'round';
    state.ctx.stroke();
}

function stopDrawing() {
    if (state.drawing) {
        state.drawing = false;
        broadcastCanvas();
        grantAccess();
    }
}

function clearCanvas() {
    if (!state.connected) {
        showNotification('not connected to server');
        return;
    }
    
    if (state.ctx) {
        state.ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
        state.socket.emit('canvas:clear');
    }
}

function broadcastCanvas() {
    if (!state.canvas || !state.connected) return;
    
    try {
        const data = state.canvas.toDataURL();
        state.socket.emit('canvas:update', data);
    } catch (e) {
        console.error('Error broadcasting canvas:', e);
    }
}

function loadCanvasData(data) {
    if (!state.canvas || !state.ctx) return;
    
    try {
        const img = new Image();
        img.onload = () => {
            state.ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
            state.ctx.drawImage(img, 0, 0);
        };
        img.src = data;
    } catch (e) {
        console.error('Error loading canvas:', e);
    }
}

/**
 * UTILITIES
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(message) {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(0, 255, 0, 0.2);
        border: 1px solid var(--primary-color);
        color: var(--primary-color);
        padding: 15px 20px;
        z-index: 1000;
        animation: slideInRight 0.3s ease-out;
        font-family: inherit;
        font-size: 0.85rem;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

// Add dynamic styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            opacity: 0;
            transform: translateX(100px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    @keyframes slideOutRight {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(100px);
        }
    }
`;
document.head.appendChild(style);

export { init };
