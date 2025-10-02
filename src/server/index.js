const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const WS_PORT = process.env.WS_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage for messages
const messages = new Map();
let messageCounter = 0;

// REST API Routes
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    messageCount: messages.size 
  });
});

app.post('/ingest', (req, res) => {
  try {
    const message = req.body;
    
    // Validate message structure
    if (!message.t || !message.id || !message.ts || !message.sig) {
      return res.status(400).json({ 
        error: 'Invalid message format',
        required: ['t', 'id', 'ts', 'sig']
      });
    }

    // Store message with timestamp
    const messageId = `msg_${++messageCounter}_${Date.now()}`;
    messages.set(messageId, {
      ...message,
      receivedAt: Date.now(),
      serverId: messageId,
    });

    console.log(`Received message: ${message.t} from ${message.id}`);

    // Echo back summary
    res.json({
      status: 'received',
      messageId,
      summary: {
        type: message.t,
        id: message.id,
        timestamp: message.ts,
        receivedAt: Date.now(),
      }
    });

  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/messages', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  
  const messageArray = Array.from(messages.values())
    .sort((a, b) => b.receivedAt - a.receivedAt)
    .slice(offset, offset + limit);

  res.json({
    messages: messageArray,
    total: messages.size,
    limit,
    offset,
  });
});

app.delete('/messages', (req, res) => {
  const count = messages.size;
  messages.clear();
  res.json({ 
    status: 'cleared', 
    deletedCount: count 
  });
});

// WebSocket Server
const wss = new WebSocket.Server({ port: WS_PORT });

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      
      // Broadcast to all connected clients
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'broadcast',
            message,
            timestamp: Date.now(),
          }));
        }
      });

      // Echo back to sender
      ws.send(JSON.stringify({
        type: 'echo',
        message,
        timestamp: Date.now(),
      }));

    } catch (error) {
      console.error('WebSocket message error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Invalid message format',
      }));
    }
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'welcome',
    message: 'Connected to AfetNet server',
    timestamp: Date.now(),
  }));
});

// Start HTTP server
app.listen(PORT, () => {
  console.log(`AfetNet server running on port ${PORT}`);
  console.log(`WebSocket server running on port ${WS_PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Messages endpoint: http://localhost:${PORT}/messages`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  wss.close(() => {
    console.log('WebSocket server closed');
    process.exit(0);
  });
});