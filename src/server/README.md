# AfetNet Server

Minimal server stub for AfetNet disaster response app testing and development.

## Features

- **Message Ingestion**: Receives and stores emergency messages from the app
- **WebSocket Support**: Real-time message broadcasting
- **Health Monitoring**: Server status and message statistics
- **Message Management**: View and clear stored messages

## Installation

```bash
cd src/server
npm install
```

## Usage

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

## Environment Variables

Create a `.env` file:

```env
PORT=3000
WS_PORT=3001
```

## API Endpoints

### Health Check
```
GET /health
```

Returns server status and message count.

### Message Ingestion
```
POST /ingest
```

Accepts emergency messages from the app.

**Request Body:**
```json
{
  "t": "HELP",
  "id": "ephemeral_id",
  "ts": 1640995200000,
  "loc": [41.0082, 28.9784, 10],
  "prio": 0,
  "flags": {
    "rubble": true,
    "injury": false
  },
  "ppl": 2,
  "note": "Trapped under rubble",
  "batt": 45,
  "ttl": 24,
  "sig": "signature_string"
}
```

### Message Retrieval
```
GET /messages?limit=50&offset=0
```

Returns stored messages with pagination.

### Clear Messages
```
DELETE /messages
```

Clears all stored messages.

## WebSocket

Connect to `ws://localhost:3001` for real-time message broadcasting.

**Message Types:**
- `welcome`: Connection established
- `echo`: Message echo back to sender
- `broadcast`: Message broadcast to other clients
- `error`: Error messages

## Testing

Use the provided test endpoints to simulate emergency scenarios:

```bash
# Health check
curl http://localhost:3000/health

# Send test message
curl -X POST http://localhost:3000/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "t": "HELP",
    "id": "test_device",
    "ts": 1640995200000,
    "loc": [41.0082, 28.9784, 10],
    "prio": 0,
    "flags": {"rubble": true, "injury": false},
    "ppl": 1,
    "note": "Test message",
    "batt": 80,
    "ttl": 6,
    "sig": "test_signature"
  }'

# Get messages
curl http://localhost:3000/messages

# Clear messages
curl -X DELETE http://localhost:3000/messages
```

## Integration with App

The app automatically connects to the server when available. Configure the server URL in the app's environment:

```env
SERVER_URL=http://localhost:3000
SERVER_WS_URL=ws://localhost:3001
```

## Production Considerations

This is a development server stub. For production use:

1. Add authentication and authorization
2. Implement proper database storage
3. Add rate limiting and validation
4. Implement proper error handling
5. Add logging and monitoring
6. Use HTTPS/WSS for secure connections
7. Add message persistence and backup

## License

Part of the AfetNet disaster response system.
