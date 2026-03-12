// Grades Backend Server - stores grades and assignments data from extension
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PORT = 3001;
const WS_PORT = 3002;

// WebSocket clients storage
const wsClients = new Set();

// Store data in a persistent 'data' folder within the project directory
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Images folder for wallpaper backgrounds
const IMAGES_DIR = path.join(DATA_DIR, 'images');
if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

const GRADES_FILE = path.join(DATA_DIR, 'grades-data.json');
const ASSIGNMENTS_FILE = path.join(DATA_DIR, 'assignments-data.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'wallpaper-settings.json');
const MISSING_FILE = path.join(DATA_DIR, 'missing-data.json');
const TERMS_FILE = path.join(DATA_DIR, 'terms-data.json');

// Initialize empty data files if they don't exist
if (!fs.existsSync(GRADES_FILE)) {
    fs.writeFileSync(GRADES_FILE, JSON.stringify({ grades: null, lastUpdated: null }));
}
if (!fs.existsSync(ASSIGNMENTS_FILE)) {
    fs.writeFileSync(ASSIGNMENTS_FILE, JSON.stringify({ assignments: null, lastUpdated: null }));
}
if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ settings: null, lastUpdated: null }));
}
if (!fs.existsSync(MISSING_FILE)) {
    fs.writeFileSync(MISSING_FILE, JSON.stringify({ missing: null, lastUpdated: null }));
}
if (!fs.existsSync(TERMS_FILE)) {
    fs.writeFileSync(TERMS_FILE, JSON.stringify({ terms: null, lastUpdated: null }));
}

// Broadcast update to all connected WebSocket clients
function broadcastUpdate(type, data) {
    const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
    wsClients.forEach(client => {
        if (client.readyState === 1) { // OPEN
            client.send(message);
        }
    });
    console.log(`[${new Date().toLocaleTimeString()}] 📡 Broadcast: ${type} to ${wsClients.size} clients`);
}

const server = http.createServer((req, res) => {
    // CORS headers - allow all origins
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // GET /grades - return stored grades
    if (req.method === 'GET' && req.url === '/grades') {
        try {
            const data = fs.readFileSync(GRADES_FILE, 'utf8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(data);
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to read grades data' }));
        }
        return;
    }
    
    // POST /grades - save grades from extension
    if (req.method === 'POST' && req.url === '/grades') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const gradesData = JSON.parse(body);
                const dataToSave = {
                    grades: gradesData,
                    lastUpdated: new Date().toISOString()
                };
                fs.writeFileSync(GRADES_FILE, JSON.stringify(dataToSave, null, 2));
                
                console.log(`[${new Date().toLocaleTimeString()}] 📊 Grades data saved!`);
                
                // Broadcast to connected clients
                broadcastUpdate('grades', dataToSave);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Grades saved' }));
            } catch (err) {
                console.error('Error saving grades:', err);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid data' }));
            }
        });
        return;
    }
    
    // GET /assignments - return stored assignments
    if (req.method === 'GET' && req.url === '/assignments') {
        try {
            const data = fs.readFileSync(ASSIGNMENTS_FILE, 'utf8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(data);
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to read assignments data' }));
        }
        return;
    }
    
    // POST /assignments - save assignments from extension
    if (req.method === 'POST' && req.url === '/assignments') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const assignmentsData = JSON.parse(body);
                
                // Protect against overwriting good data with empty data
                if (!assignmentsData || (Array.isArray(assignmentsData) && assignmentsData.length === 0)) {
                    // Check if we already have data
                    try {
                        const existingData = JSON.parse(fs.readFileSync(ASSIGNMENTS_FILE, 'utf8'));
                        if (existingData.assignments && existingData.assignments.length > 0) {
                            console.log(`[${new Date().toLocaleTimeString()}] ⚠️ Skipping empty assignments update (keeping ${existingData.assignments.length} existing assignments)`);
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: true, message: 'Kept existing data (received empty)' }));
                            return;
                        }
                    } catch (e) {
                        // No existing data, allow the empty save
                    }
                }
                
                const dataToSave = {
                    assignments: assignmentsData,
                    lastUpdated: new Date().toISOString()
                };
                fs.writeFileSync(ASSIGNMENTS_FILE, JSON.stringify(dataToSave, null, 2));
                
                console.log(`[${new Date().toLocaleTimeString()}] 📝 Assignments data saved! (${Array.isArray(assignmentsData) ? assignmentsData.length : 0} assignments)`);
                
                // Broadcast to connected clients
                broadcastUpdate('assignments', dataToSave);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Assignments saved' }));
            } catch (err) {
                console.error('Error saving assignments:', err);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid data' }));
            }
        });
        return;
    }
    
    // GET /all - return both grades and assignments
    if (req.method === 'GET' && req.url === '/all') {
        try {
            const gradesData = JSON.parse(fs.readFileSync(GRADES_FILE, 'utf8'));
            const assignmentsData = JSON.parse(fs.readFileSync(ASSIGNMENTS_FILE, 'utf8'));
            const missingData = JSON.parse(fs.readFileSync(MISSING_FILE, 'utf8'));
            const termsData = JSON.parse(fs.readFileSync(TERMS_FILE, 'utf8'));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                grades: gradesData.grades,
                gradesLastUpdated: gradesData.lastUpdated,
                assignments: assignmentsData.assignments,
                assignmentsLastUpdated: assignmentsData.lastUpdated,
                missing: missingData.missing,
                missingLastUpdated: missingData.lastUpdated,
                terms: termsData.terms,
                termsLastUpdated: termsData.lastUpdated
            }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to read data' }));
        }
        return;
    }

    // GET /missing - return stored missing assignments
    if (req.method === 'GET' && req.url === '/missing') {
        try {
            const data = fs.readFileSync(MISSING_FILE, 'utf8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(data);
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to read missing data' }));
        }
        return;
    }

    // POST /missing - save missing assignments from extension
    if (req.method === 'POST' && req.url === '/missing') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const missingData = JSON.parse(body);
                const dataToSave = { missing: missingData, lastUpdated: new Date().toISOString() };
                fs.writeFileSync(MISSING_FILE, JSON.stringify(dataToSave, null, 2));
                console.log(`[${new Date().toLocaleTimeString()}] ⚠️ Missing assignments saved! (${missingData.missingAssignmentsTotal ?? 0} missing)`);
                broadcastUpdate('missing', dataToSave);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Missing assignments saved' }));
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid data' }));
            }
        });
        return;
    }

    // GET /terms - return stored terms
    if (req.method === 'GET' && req.url === '/terms') {
        try {
            const data = fs.readFileSync(TERMS_FILE, 'utf8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(data);
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to read terms data' }));
        }
        return;
    }

    // POST /terms - save terms from extension
    if (req.method === 'POST' && req.url === '/terms') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const termsData = JSON.parse(body);
                const dataToSave = { terms: termsData, lastUpdated: new Date().toISOString() };
                fs.writeFileSync(TERMS_FILE, JSON.stringify(dataToSave, null, 2));
                console.log(`[${new Date().toLocaleTimeString()}] 📅 Terms saved! (${Array.isArray(termsData) ? termsData.length : 0} terms)`);
                broadcastUpdate('terms', dataToSave);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Terms saved' }));
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid data' }));
            }
        });
        return;
    }
    
    // GET /settings - return stored settings
    if (req.method === 'GET' && req.url === '/settings') {
        try {
            const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(data);
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to read settings data' }));
        }
        return;
    }
    
    // GET /image/:filename - serve stored images
    if (req.method === 'GET' && req.url.startsWith('/image/')) {
        const filename = req.url.replace('/image/', '');
        const imagePath = path.join(IMAGES_DIR, filename);
        
        if (fs.existsSync(imagePath)) {
            const ext = path.extname(filename).toLowerCase();
            const mimeTypes = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
                '.bmp': 'image/bmp'
            };
            const contentType = mimeTypes[ext] || 'application/octet-stream';
            
            const imageData = fs.readFileSync(imagePath);
            res.writeHead(200, { 
                'Content-Type': contentType,
                'Cache-Control': 'max-age=3600'
            });
            res.end(imageData);
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Image not found' }));
        }
        return;
    }
    
    // POST /settings - save settings
    if (req.method === 'POST' && req.url === '/settings') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const settingsData = JSON.parse(body);
                
                // If backgroundImage is a base64 data URL, save it as a file
                if (settingsData.backgroundImage && settingsData.backgroundImage.startsWith('data:image/')) {
                    try {
                        const matches = settingsData.backgroundImage.match(/^data:image\/(\w+);base64,(.+)$/);
                        if (matches) {
                            let ext = matches[1];
                            if (ext === 'jpeg') ext = 'jpg';
                            const base64Data = matches[2];
                            const filename = `wallpaper.${ext}`;
                            const imagePath = path.join(IMAGES_DIR, filename);
                            
                            // Write the image file
                            fs.writeFileSync(imagePath, Buffer.from(base64Data, 'base64'));
                            
                            // Replace base64 with URL reference
                            settingsData.backgroundImage = `http://localhost:${PORT}/image/${filename}`;
                            console.log(`[${new Date().toLocaleTimeString()}] 🖼️ Image saved as ${filename}`);
                        }
                    } catch (imgErr) {
                        console.error('Error saving image file:', imgErr);
                    }
                }
                
                const dataToSave = {
                    settings: settingsData,
                    lastUpdated: new Date().toISOString()
                };
                fs.writeFileSync(SETTINGS_FILE, JSON.stringify(dataToSave, null, 2));
                
                console.log(`[${new Date().toLocaleTimeString()}] ⚙️ Settings saved!`);
                
                // Broadcast to connected clients
                broadcastUpdate('settings', dataToSave);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Settings saved' }));
            } catch (err) {
                console.error('Error saving settings:', err);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid data' }));
            }
        });
        return;
    }
    
    // 404 for other routes
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
    console.log(`\n📚 Grades Backend Server running on http://localhost:${PORT}`);
    console.log(`🔌 WebSocket Server running on ws://localhost:${WS_PORT}`);
    console.log(`\nEndpoints:`);
    console.log(`  GET  /grades      - Retrieve stored grades`);
    console.log(`  POST /grades      - Save grades (from extension)`);
    console.log(`  GET  /assignments - Retrieve stored assignments`);
    console.log(`  POST /assignments - Save assignments (from extension)`);
    console.log(`  GET  /missing     - Retrieve stored missing assignments`);
    console.log(`  POST /missing     - Save missing assignments (from extension)`);
    console.log(`  GET  /terms       - Retrieve stored terms`);
    console.log(`  POST /terms       - Save terms (from extension)`);
    console.log(`  GET  /settings    - Retrieve wallpaper settings`);
    console.log(`  POST /settings    - Save wallpaper settings`);
    console.log(`  GET  /all         - Retrieve all data`);
    console.log(`\nWebSocket: Real-time updates pushed to connected clients\n`);
});

// ============ WebSocket Server (Raw Implementation) ============
const wsServer = http.createServer();

wsServer.on('upgrade', (req, socket) => {
    // WebSocket handshake
    const key = req.headers['sec-websocket-key'];
    const acceptKey = crypto
        .createHash('sha1')
        .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
        .digest('base64');
    
    const responseHeaders = [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${acceptKey}`,
        '',
        ''
    ].join('\r\n');
    
    socket.write(responseHeaders);
    
    // Create a client object
    const client = {
        socket,
        readyState: 1,
        send: (data) => {
            const payload = Buffer.from(data);
            const frame = createWebSocketFrame(payload);
            socket.write(frame);
        }
    };
    
    wsClients.add(client);
    console.log(`[${new Date().toLocaleTimeString()}] 🔗 WebSocket client connected (${wsClients.size} total)`);
    
    // Send initial data on connect
    try {
        const gradesData = JSON.parse(fs.readFileSync(GRADES_FILE, 'utf8'));
        const assignmentsData = JSON.parse(fs.readFileSync(ASSIGNMENTS_FILE, 'utf8'));
        const settingsData = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
        const missingData = JSON.parse(fs.readFileSync(MISSING_FILE, 'utf8'));
        const termsData = JSON.parse(fs.readFileSync(TERMS_FILE, 'utf8'));
        
        client.send(JSON.stringify({
            type: 'init',
            data: {
                grades: gradesData,
                assignments: assignmentsData,
                settings: settingsData,
                missing: missingData,
                terms: termsData
            },
            timestamp: new Date().toISOString()
        }));
    } catch (err) {
        console.error('Error sending initial data:', err);
    }
    
    // Handle incoming messages
    socket.on('data', (buffer) => {
        const message = parseWebSocketFrame(buffer);
        if (message) {
            try {
                const parsed = JSON.parse(message);
                if (parsed.type === 'ping') {
                    client.send(JSON.stringify({ type: 'pong' }));
                }
            } catch (e) {}
        }
    });
    
    socket.on('close', () => {
        client.readyState = 3;
        wsClients.delete(client);
        console.log(`[${new Date().toLocaleTimeString()}] 🔌 WebSocket client disconnected (${wsClients.size} remaining)`);
    });
    
    socket.on('error', (err) => {
        client.readyState = 3;
        wsClients.delete(client);
    });
});

// WebSocket frame helpers
function createWebSocketFrame(payload) {
    const length = payload.length;
    let frame;
    
    if (length < 126) {
        frame = Buffer.alloc(2 + length);
        frame[0] = 0x81; // FIN + text frame
        frame[1] = length;
        payload.copy(frame, 2);
    } else if (length < 65536) {
        frame = Buffer.alloc(4 + length);
        frame[0] = 0x81;
        frame[1] = 126;
        frame.writeUInt16BE(length, 2);
        payload.copy(frame, 4);
    } else {
        frame = Buffer.alloc(10 + length);
        frame[0] = 0x81;
        frame[1] = 127;
        frame.writeBigUInt64BE(BigInt(length), 2);
        payload.copy(frame, 10);
    }
    
    return frame;
}

function parseWebSocketFrame(buffer) {
    if (buffer.length < 2) return null;
    
    const secondByte = buffer[1];
    const isMasked = (secondByte & 0x80) !== 0;
    let payloadLength = secondByte & 0x7f;
    let offset = 2;
    
    if (payloadLength === 126) {
        payloadLength = buffer.readUInt16BE(2);
        offset = 4;
    } else if (payloadLength === 127) {
        payloadLength = Number(buffer.readBigUInt64BE(2));
        offset = 10;
    }
    
    let mask;
    if (isMasked) {
        mask = buffer.slice(offset, offset + 4);
        offset += 4;
    }
    
    const payload = buffer.slice(offset, offset + payloadLength);
    
    if (isMasked) {
        for (let i = 0; i < payload.length; i++) {
            payload[i] ^= mask[i % 4];
        }
    }
    
    return payload.toString('utf8');
}

wsServer.listen(WS_PORT);
