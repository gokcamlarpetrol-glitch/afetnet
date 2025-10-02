from fastapi import WebSocket, WebSocketDisconnect
import json
import asyncio
from typing import Set, Dict, Any

class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        print(f"WebSocket connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        print(f"WebSocket disconnected. Total connections: {len(self.active_connections)}")

    async def send_personal_message(self, message: str, websocket: WebSocket):
        try:
            await websocket.send_text(message)
        except Exception as e:
            print(f"Error sending personal message: {e}")
            self.disconnect(websocket)

    async def broadcast(self, message: Dict[str, Any]):
        if not self.active_connections:
            return
            
        message_str = json.dumps(message)
        disconnected = set()
        
        for connection in self.active_connections:
            try:
                await connection.send_text(message_str)
            except Exception as e:
                print(f"Error broadcasting to WebSocket: {e}")
                disconnected.add(connection)
        
        # Remove disconnected connections
        for connection in disconnected:
            self.disconnect(connection)

    async def broadcast_help_request(self, help_request: Dict[str, Any]):
        await self.broadcast({
            "type": "help_request",
            "data": help_request,
            "timestamp": int(time.time() * 1000)
        })

    async def broadcast_resource(self, resource: Dict[str, Any]):
        await self.broadcast({
            "type": "resource",
            "data": resource,
            "timestamp": int(time.time() * 1000)
        })

    async def broadcast_damage_report(self, damage_report: Dict[str, Any]):
        await self.broadcast({
            "type": "damage_report",
            "data": damage_report,
            "timestamp": int(time.time() * 1000)
        })

    async def send_ping(self, websocket: WebSocket):
        """Send ping to keep connection alive"""
        try:
            await websocket.send_text(json.dumps({
                "type": "ping",
                "timestamp": int(time.time() * 1000)
            }))
        except Exception as e:
            print(f"Error sending ping: {e}")
            self.disconnect(websocket)

    def get_connection_count(self) -> int:
        return len(self.active_connections)

manager = ConnectionManager()

async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    
    try:
        # Send greeting message
        await websocket.send_text(json.dumps({
            "type": "greeting",
            "message": "Connected to AfetNet WebSocket",
            "timestamp": int(time.time() * 1000)
        }))
        
        # Start ping task
        ping_task = asyncio.create_task(ping_loop(websocket))
        
        while True:
            try:
                # Wait for messages from client
                data = await websocket.receive_text()
                message = json.loads(data)
                
                # Handle different message types
                if message.get("type") == "pong":
                    print("Received pong from client")
                elif message.get("type") == "subscribe":
                    # Handle subscription to specific topics
                    topics = message.get("topics", [])
                    print(f"Client subscribed to topics: {topics}")
                elif message.get("type") == "unsubscribe":
                    # Handle unsubscription
                    topics = message.get("topics", [])
                    print(f"Client unsubscribed from topics: {topics}")
                else:
                    print(f"Unknown message type: {message.get('type')}")
                    
            except WebSocketDisconnect:
                break
            except json.JSONDecodeError:
                print("Invalid JSON received")
            except Exception as e:
                print(f"Error processing message: {e}")
                
    except WebSocketDisconnect:
        pass
    finally:
        ping_task.cancel()
        manager.disconnect(websocket)

async def ping_loop(websocket: WebSocket):
    """Send ping every 30 seconds to keep connection alive"""
    try:
        while True:
            await asyncio.sleep(30)
            await manager.send_ping(websocket)
    except asyncio.CancelledError:
        pass

# Export manager for use in main.py
__all__ = ['manager', 'websocket_endpoint']
