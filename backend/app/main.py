from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
import time
from typing import Dict, Any

app = FastAPI(
    title="AfetNet Backend API",
    description="Backend API for AfetNet emergency network",
    version="1.0.0"
)

# CORS middleware for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": int(time.time() * 1000),
        "version": "1.0.0",
        "uptime": int(time.time() - start_time)
    }

@app.post("/help-requests")
async def create_help_request(request_data: Dict[str, Any]):
    """Create a new help request"""
    try:
        # In production, save to database
        print(f"Help request received: {request_data}")
        
        # Broadcast to WebSocket clients
        await broadcast_to_websockets({
            "type": "help_request",
            "data": request_data,
            "timestamp": int(time.time() * 1000)
        })
        
        return {
            "success": True,
            "id": f"help_{int(time.time() * 1000)}",
            "message": "Help request created successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/resources")
async def create_resource(resource_data: Dict[str, Any]):
    """Create a new resource post"""
    try:
        print(f"Resource post received: {resource_data}")
        
        await broadcast_to_websockets({
            "type": "resource",
            "data": resource_data,
            "timestamp": int(time.time() * 1000)
        })
        
        return {
            "success": True,
            "id": f"resource_{int(time.time() * 1000)}",
            "message": "Resource post created successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/damage-reports")
async def create_damage_report(report_data: Dict[str, Any]):
    """Create a new damage report"""
    try:
        print(f"Damage report received: {report_data}")
        
        await broadcast_to_websockets({
            "type": "damage_report",
            "data": report_data,
            "timestamp": int(time.time() * 1000)
        })
        
        return {
            "success": True,
            "id": f"damage_{int(time.time() * 1000)}",
            "message": "Damage report created successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/stats")
async def get_stats():
    """Get system statistics"""
    return {
        "active_connections": len(active_connections),
        "total_help_requests": 0,  # In production, get from database
        "total_resources": 0,
        "total_damage_reports": 0,
        "uptime": int(time.time() - start_time)
    }

# WebSocket connection management
active_connections: set = set()

async def broadcast_to_websockets(message: Dict[str, Any]):
    """Broadcast message to all connected WebSocket clients"""
    if active_connections:
        for connection in active_connections.copy():
            try:
                await connection.send_text(str(message))
            except Exception as e:
                print(f"Error broadcasting to WebSocket: {e}")
                active_connections.discard(connection)

# Start time for uptime calculation
start_time = time.time()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
