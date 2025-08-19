"""
WebSocket routes for real-time collection progress updates.
Handles real-time indexing progress, status updates, and error notifications.
"""
import asyncio
import json
import logging
from typing import Dict, Any, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from fastapi.websockets import WebSocketState

from services.collection_manager import CollectionManager
from api.dependencies import get_collection_manager

logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/ws/collections", tags=["WebSocket"])

# Active WebSocket connections per collection
active_connections: Dict[str, list] = {}


class ConnectionManager:
    """Manages WebSocket connections for collection progress updates."""
    
    def __init__(self):
        self.active_connections: Dict[str, list] = {}
    
    async def connect(self, websocket: WebSocket, collection_name: str):
        """Connect a client to collection updates."""
        await websocket.accept()
        
        if collection_name not in self.active_connections:
            self.active_connections[collection_name] = []
        
        self.active_connections[collection_name].append(websocket)
        logger.info(f"WebSocket connected for collection '{collection_name}'. "
                   f"Total connections: {len(self.active_connections[collection_name])}")
    
    def disconnect(self, websocket: WebSocket, collection_name: str):
        """Disconnect a client from collection updates."""
        if collection_name in self.active_connections:
            try:
                self.active_connections[collection_name].remove(websocket)
                logger.info(f"WebSocket disconnected from collection '{collection_name}'. "
                           f"Remaining connections: {len(self.active_connections[collection_name])}")
                
                # Clean up empty connection lists
                if not self.active_connections[collection_name]:
                    del self.active_connections[collection_name]
                    
            except ValueError:
                # WebSocket was not in the list
                pass
    
    async def send_to_collection(self, collection_name: str, data: Dict[str, Any]):
        """Send data to all clients connected to a collection."""
        if collection_name not in self.active_connections:
            return
        
        message = json.dumps(data)
        disconnected = []
        
        for websocket in self.active_connections[collection_name]:
            try:
                if websocket.client_state == WebSocketState.CONNECTED:
                    await websocket.send_text(message)
                else:
                    disconnected.append(websocket)
            except Exception as e:
                logger.warning(f"Error sending WebSocket message: {str(e)}")
                disconnected.append(websocket)
        
        # Clean up disconnected websockets
        for ws in disconnected:
            self.disconnect(ws, collection_name)
    
    async def send_progress_update(self, collection_name: str, progress_data: Dict[str, Any]):
        """Send progress update to collection subscribers."""
        message = {
            "type": "progress_update",
            "collection_name": collection_name,
            "timestamp": progress_data.get("timestamp"),
            "data": progress_data
        }
        await self.send_to_collection(collection_name, message)
    
    async def send_status_change(self, collection_name: str, status: str, details: Optional[Dict] = None):
        """Send status change notification to collection subscribers."""
        message = {
            "type": "status_change",
            "collection_name": collection_name,
            "status": status,
            "details": details or {},
            "timestamp": asyncio.get_event_loop().time()
        }
        await self.send_to_collection(collection_name, message)
    
    async def send_error(self, collection_name: str, error_message: str, error_details: Optional[Dict] = None):
        """Send error notification to collection subscribers."""
        message = {
            "type": "error",
            "collection_name": collection_name,
            "error": error_message,
            "details": error_details or {},
            "timestamp": asyncio.get_event_loop().time()
        }
        await self.send_to_collection(collection_name, message)
    
    def get_connection_count(self, collection_name: str) -> int:
        """Get number of active connections for a collection."""
        return len(self.active_connections.get(collection_name, []))
    
    def get_all_connections_count(self) -> int:
        """Get total number of active connections across all collections."""
        return sum(len(connections) for connections in self.active_connections.values())


# Global connection manager instance
manager = ConnectionManager()


@router.websocket("/{collection_name}/progress")
async def collection_progress_websocket(
    websocket: WebSocket,
    collection_name: str,
    collection_manager: CollectionManager = Depends(get_collection_manager)
):
    """
    WebSocket endpoint for real-time collection progress updates.
    
    **Path Parameters:**
    - `collection_name`: Collection to monitor
    
    **WebSocket Messages:**
    - `progress_update`: Real-time indexing progress
    - `status_change`: Collection status changes
    - `error`: Error notifications with detailed context
    - `heartbeat`: Connection health check
    
    **Message Format:**
    ```json
    {
        "type": "progress_update|status_change|error|heartbeat",
        "collection_name": "collection_name",
        "timestamp": 1234567890.123,
        "data": { ... }
    }
    ```
    
    **Progress Update Data:**
    ```json
    {
        "progress_percentage": 85.5,
        "current_file": "notes/machine-learning.md",
        "files_processed": 203,
        "total_files": 247,
        "documents_created": 1247,
        "chunks_created": 5832,
        "processing_rate": 12.5,
        "eta_seconds": 45,
        "errors_count": 0,
        "last_error": null
    }
    ```
    
    **Connection Recovery:**
    - Exponential backoff for reconnection
    - State synchronization on reconnect
    - Handles connection drops gracefully
    """
    correlation_id = f"ws-{collection_name}-{id(websocket)}"
    
    try:
        # Connect to the collection updates
        await manager.connect(websocket, collection_name)
        
        logger.info(f"WebSocket connection established for collection '{collection_name}' [{correlation_id}]")
        
        # Verify collection exists
        collection_status = await collection_manager.get_collection_status(collection_name)
        if not collection_status:
            await websocket.send_text(json.dumps({
                "type": "error",
                "error": f"Collection '{collection_name}' not found",
                "timestamp": asyncio.get_event_loop().time()
            }))
            await websocket.close(code=4004, reason="Collection not found")
            return
        
        # Send initial status
        await websocket.send_text(json.dumps({
            "type": "connection_established",
            "collection_name": collection_name,
            "initial_status": collection_status,
            "timestamp": asyncio.get_event_loop().time()
        }))
        
        # Keep connection alive and handle client messages
        heartbeat_interval = 30  # seconds
        last_heartbeat = asyncio.get_event_loop().time()
        
        while True:
            try:
                # Wait for message or timeout for heartbeat
                message = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=heartbeat_interval
                )
                
                # Handle client messages
                try:
                    client_data = json.loads(message)
                    await handle_client_message(websocket, collection_name, client_data, collection_manager)
                except json.JSONDecodeError:
                    logger.warning(f"Invalid JSON from client: {message} [{correlation_id}]")
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "error": "Invalid JSON format",
                        "timestamp": asyncio.get_event_loop().time()
                    }))
                    
            except asyncio.TimeoutError:
                # Send heartbeat
                current_time = asyncio.get_event_loop().time()
                if current_time - last_heartbeat >= heartbeat_interval:
                    try:
                        await websocket.send_text(json.dumps({
                            "type": "heartbeat",
                            "timestamp": current_time,
                            "connections_count": manager.get_connection_count(collection_name)
                        }))
                        last_heartbeat = current_time
                    except Exception as e:
                        logger.warning(f"Failed to send heartbeat: {str(e)} [{correlation_id}]")
                        break
                        
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected normally for collection '{collection_name}' [{correlation_id}]")
    except Exception as e:
        logger.error(f"WebSocket error for collection '{collection_name}': {str(e)} [{correlation_id}]", exc_info=True)
    finally:
        # Clean up connection
        manager.disconnect(websocket, collection_name)
        logger.info(f"WebSocket connection cleaned up for collection '{collection_name}' [{correlation_id}]")


async def handle_client_message(
    websocket: WebSocket,
    collection_name: str,
    message: Dict[str, Any],
    collection_manager: CollectionManager
):
    """Handle messages received from WebSocket clients."""
    message_type = message.get("type")
    correlation_id = f"ws-{collection_name}-{id(websocket)}"
    
    try:
        if message_type == "get_status":
            # Send current status
            status = await collection_manager.get_collection_status(collection_name)
            await websocket.send_text(json.dumps({
                "type": "status_response",
                "collection_name": collection_name,
                "status": status,
                "timestamp": asyncio.get_event_loop().time()
            }))
            
        elif message_type == "pause_indexing":
            # Pause indexing operation
            try:
                result = await collection_manager.pause_indexing(collection_name)
                await websocket.send_text(json.dumps({
                    "type": "operation_response",
                    "operation": "pause_indexing",
                    "success": True,
                    "result": result,
                    "timestamp": asyncio.get_event_loop().time()
                }))
            except Exception as e:
                await websocket.send_text(json.dumps({
                    "type": "operation_response",
                    "operation": "pause_indexing",
                    "success": False,
                    "error": str(e),
                    "timestamp": asyncio.get_event_loop().time()
                }))
                
        elif message_type == "resume_indexing":
            # Resume indexing operation
            try:
                result = await collection_manager.resume_indexing(collection_name)
                await websocket.send_text(json.dumps({
                    "type": "operation_response",
                    "operation": "resume_indexing",
                    "success": True,
                    "result": result,
                    "timestamp": asyncio.get_event_loop().time()
                }))
            except Exception as e:
                await websocket.send_text(json.dumps({
                    "type": "operation_response",
                    "operation": "resume_indexing",
                    "success": False,
                    "error": str(e),
                    "timestamp": asyncio.get_event_loop().time()
                }))
                
        elif message_type == "cancel_indexing":
            # Cancel indexing operation
            try:
                result = await collection_manager.cancel_indexing(collection_name)
                await websocket.send_text(json.dumps({
                    "type": "operation_response",
                    "operation": "cancel_indexing",
                    "success": True,
                    "result": result,
                    "timestamp": asyncio.get_event_loop().time()
                }))
            except Exception as e:
                await websocket.send_text(json.dumps({
                    "type": "operation_response",
                    "operation": "cancel_indexing",
                    "success": False,
                    "error": str(e),
                    "timestamp": asyncio.get_event_loop().time()
                }))
                
        else:
            # Unknown message type
            await websocket.send_text(json.dumps({
                "type": "error",
                "error": f"Unknown message type: {message_type}",
                "timestamp": asyncio.get_event_loop().time()
            }))
            
    except Exception as e:
        logger.error(f"Error handling client message: {str(e)} [{correlation_id}]", exc_info=True)
        await websocket.send_text(json.dumps({
            "type": "error",
            "error": "Internal server error handling message",
            "timestamp": asyncio.get_event_loop().time()
        }))


# Utility functions for external services to broadcast updates
async def broadcast_progress_update(collection_name: str, progress_data: Dict[str, Any]):
    """Broadcast progress update to all connected clients for a collection."""
    await manager.send_progress_update(collection_name, progress_data)


async def broadcast_status_change(collection_name: str, status: str, details: Optional[Dict] = None):
    """Broadcast status change to all connected clients for a collection."""
    await manager.send_status_change(collection_name, status, details)


async def broadcast_error(collection_name: str, error_message: str, error_details: Optional[Dict] = None):
    """Broadcast error to all connected clients for a collection."""
    await manager.send_error(collection_name, error_message, error_details)


def get_connection_stats() -> Dict[str, int]:
    """Get statistics about active WebSocket connections."""
    return {
        "total_connections": manager.get_all_connections_count(),
        "collections_with_connections": len(manager.active_connections),
        "connections_per_collection": {
            collection: len(connections)
            for collection, connections in manager.active_connections.items()
        }
    }


# Health check endpoint for WebSocket status
@router.get("/stats")
async def get_websocket_stats():
    """Get WebSocket connection statistics for monitoring."""
    return {
        "status": "healthy",
        "stats": get_connection_stats(),
        "timestamp": asyncio.get_event_loop().time()
    }