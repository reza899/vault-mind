"""
WebSocket handlers for real-time progress updates.
Provides live progress tracking for indexing operations and system events.
"""
import json
import logging
from typing import Dict, Any, Set
from datetime import datetime

from fastapi import WebSocket, WebSocketDisconnect

from api.dependencies import get_vault_service

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections and broadcasting."""
    
    def __init__(self):
        # Active connections by connection ID
        self.active_connections: Dict[str, WebSocket] = {}
        # Connection subscriptions (connection_id -> set of subscribed channels)
        self.subscriptions: Dict[str, Set[str]] = {}
        # Channel subscribers (channel -> set of connection_ids)
        self.channels: Dict[str, Set[str]] = {}
        
    def generate_connection_id(self) -> str:
        """Generate unique connection ID."""
        import uuid
        return str(uuid.uuid4())
    
    async def connect(self, websocket: WebSocket) -> str:
        """Accept new WebSocket connection."""
        await websocket.accept()
        connection_id = self.generate_connection_id()
        
        self.active_connections[connection_id] = websocket
        self.subscriptions[connection_id] = set()
        
        logger.info(f"WebSocket connected: {connection_id}")
        
        # Send welcome message
        await self.send_personal_message({
            "type": "connection_established",
            "connection_id": connection_id,
            "timestamp": datetime.now().isoformat(),
            "message": "WebSocket connection established"
        }, connection_id)
        
        return connection_id
    
    def disconnect(self, connection_id: str):
        """Remove connection and clean up subscriptions."""
        if connection_id in self.active_connections:
            # Remove from all channels
            if connection_id in self.subscriptions:
                for channel in self.subscriptions[connection_id]:
                    if channel in self.channels:
                        self.channels[channel].discard(connection_id)
                        if not self.channels[channel]:
                            del self.channels[channel]
                del self.subscriptions[connection_id]
            
            del self.active_connections[connection_id]
            logger.info(f"WebSocket disconnected: {connection_id}")
    
    async def send_personal_message(self, message: Dict[str, Any], connection_id: str):
        """Send message to specific connection."""
        if connection_id in self.active_connections:
            try:
                websocket = self.active_connections[connection_id]
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Error sending message to {connection_id}: {e}")
                self.disconnect(connection_id)
    
    async def broadcast_to_channel(self, message: Dict[str, Any], channel: str):
        """Broadcast message to all subscribers of a channel."""
        if channel in self.channels:
            disconnected = []
            
            for connection_id in self.channels[channel]:
                try:
                    if connection_id in self.active_connections:
                        websocket = self.active_connections[connection_id]
                        await websocket.send_text(json.dumps(message))
                except Exception as e:
                    logger.error(f"Error broadcasting to {connection_id}: {e}")
                    disconnected.append(connection_id)
            
            # Clean up disconnected connections
            for connection_id in disconnected:
                self.disconnect(connection_id)
    
    async def subscribe_to_channel(self, connection_id: str, channel: str):
        """Subscribe connection to a channel."""
        if connection_id in self.active_connections:
            self.subscriptions[connection_id].add(channel)
            
            if channel not in self.channels:
                self.channels[channel] = set()
            self.channels[channel].add(connection_id)
            
            logger.info(f"Connection {connection_id} subscribed to channel: {channel}")
            
            await self.send_personal_message({
                "type": "subscription_confirmed",
                "channel": channel,
                "timestamp": datetime.now().isoformat(),
                "message": f"Subscribed to channel: {channel}"
            }, connection_id)
    
    async def unsubscribe_from_channel(self, connection_id: str, channel: str):
        """Unsubscribe connection from a channel."""
        if connection_id in self.subscriptions:
            self.subscriptions[connection_id].discard(channel)
            
            if channel in self.channels:
                self.channels[channel].discard(connection_id)
                if not self.channels[channel]:
                    del self.channels[channel]
            
            logger.info(f"Connection {connection_id} unsubscribed from channel: {channel}")
            
            await self.send_personal_message({
                "type": "subscription_removed",
                "channel": channel,
                "timestamp": datetime.now().isoformat(),
                "message": f"Unsubscribed from channel: {channel}"
            }, connection_id)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get connection statistics."""
        return {
            "total_connections": len(self.active_connections),
            "total_channels": len(self.channels),
            "connections_per_channel": {
                channel: len(subscribers) 
                for channel, subscribers in self.channels.items()
            }
        }


# Global connection manager
manager = ConnectionManager()


class ProgressEventHandler:
    """Handles progress events from VaultService and broadcasts via WebSocket."""
    
    def __init__(self, connection_manager: ConnectionManager):
        self.manager = connection_manager
    
    async def handle_progress_event(self, event_type: str, data: Dict[str, Any]):
        """Handle progress event and broadcast to appropriate channels."""
        try:
            # Add timestamp if not present
            if "timestamp" not in data:
                data["timestamp"] = datetime.now().isoformat()
            
            message = {
                "type": event_type,
                "data": data,
                "timestamp": data["timestamp"]
            }
            
            # Determine channels to broadcast to
            channels = []
            
            # Global events channel
            channels.append("events")
            
            # Job-specific channel
            if "job_id" in data:
                channels.append(f"job:{data['job_id']}")
            
            # Vault-specific channel
            if "vault_name" in data:
                channels.append(f"vault:{data['vault_name']}")
            
            # Broadcast to all relevant channels
            for channel in channels:
                await self.manager.broadcast_to_channel(message, channel)
            
            logger.debug(f"Broadcasted {event_type} to channels: {channels}")
            
        except Exception as e:
            logger.error(f"Error handling progress event {event_type}: {e}")


# Global progress event handler
progress_handler = ProgressEventHandler(manager)


async def websocket_endpoint(websocket: WebSocket):
    """
    Main WebSocket endpoint for real-time updates.
    
    **Connection Flow:**
    1. Client connects to WebSocket
    2. Server sends connection confirmation
    3. Client subscribes to channels of interest
    4. Server broadcasts relevant events to subscribed channels
    5. Client receives real-time updates
    
    **Available Channels:**
    - `events`: All system events
    - `job:{job_id}`: Specific indexing job progress
    - `vault:{vault_name}`: Vault-specific events
    - `system`: System health and status updates
    
    **Message Types:**
    - `indexing_started`: Job started with initial info
    - `indexing_progress`: Progress updates with file counts
    - `indexing_completed`: Job finished successfully  
    - `indexing_error`: Job failed with error details
    - `connection_established`: WebSocket connected
    - `subscription_confirmed`: Channel subscription confirmed
    
    **Client Commands:**
    - `{"action": "subscribe", "channel": "events"}`: Subscribe to channel
    - `{"action": "unsubscribe", "channel": "events"}`: Unsubscribe from channel
    - `{"action": "get_stats"}`: Get connection statistics
    - `{"action": "ping"}`: Ping/pong for connection testing
    """
    connection_id = await manager.connect(websocket)
    
    try:
        # Set up progress callback for this connection
        vault_service = get_vault_service()
        vault_service.add_progress_callback(progress_handler.handle_progress_event)
        
        while True:
            try:
                # Wait for messages from client
                data = await websocket.receive_text()
                message = json.loads(data)
                
                action = message.get("action")
                
                if action == "subscribe":
                    channel = message.get("channel")
                    if channel:
                        await manager.subscribe_to_channel(connection_id, channel)
                    else:
                        await manager.send_personal_message({
                            "type": "error",
                            "message": "Channel name required for subscription",
                            "timestamp": datetime.now().isoformat()
                        }, connection_id)
                
                elif action == "unsubscribe":
                    channel = message.get("channel")
                    if channel:
                        await manager.unsubscribe_from_channel(connection_id, channel)
                    else:
                        await manager.send_personal_message({
                            "type": "error", 
                            "message": "Channel name required for unsubscription",
                            "timestamp": datetime.now().isoformat()
                        }, connection_id)
                
                elif action == "get_stats":
                    stats = manager.get_stats()
                    await manager.send_personal_message({
                        "type": "stats",
                        "data": stats,
                        "timestamp": datetime.now().isoformat()
                    }, connection_id)
                
                elif action == "ping":
                    await manager.send_personal_message({
                        "type": "pong",
                        "timestamp": datetime.now().isoformat()
                    }, connection_id)
                
                else:
                    await manager.send_personal_message({
                        "type": "error",
                        "message": f"Unknown action: {action}",
                        "timestamp": datetime.now().isoformat()
                    }, connection_id)
                
            except json.JSONDecodeError:
                await manager.send_personal_message({
                    "type": "error",
                    "message": "Invalid JSON message",
                    "timestamp": datetime.now().isoformat()
                }, connection_id)
            
            except Exception as e:
                logger.error(f"Error processing WebSocket message: {e}")
                await manager.send_personal_message({
                    "type": "error",
                    "message": "Error processing message",
                    "timestamp": datetime.now().isoformat()
                }, connection_id)
    
    except WebSocketDisconnect:
        manager.disconnect(connection_id)
        logger.info(f"WebSocket client disconnected: {connection_id}")
    
    except Exception as e:
        logger.error(f"WebSocket error for {connection_id}: {e}")
        manager.disconnect(connection_id)
    
    finally:
        # Clean up progress callback
        try:
            vault_service = get_vault_service()
            vault_service.remove_progress_callback(progress_handler.handle_progress_event)
        except Exception:
            pass  # Service might not be available during shutdown


# Utility functions for broadcasting system events
async def broadcast_system_event(event_type: str, data: Dict[str, Any]):
    """Broadcast system-level events to WebSocket clients."""
    await progress_handler.handle_progress_event(event_type, data)


async def broadcast_vault_event(vault_name: str, event_type: str, data: Dict[str, Any]):
    """Broadcast vault-specific events to WebSocket clients."""
    data["vault_name"] = vault_name
    await progress_handler.handle_progress_event(event_type, data)


async def broadcast_job_event(job_id: str, event_type: str, data: Dict[str, Any]):
    """Broadcast job-specific events to WebSocket clients."""
    data["job_id"] = job_id
    await progress_handler.handle_progress_event(event_type, data)