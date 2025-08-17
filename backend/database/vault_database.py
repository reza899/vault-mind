"""
Unified VaultDatabase class.
Combines ChromaDB client and collection management functionality.
"""
import asyncio
import logging
import re
from pathlib import Path
from typing import Dict, List, Any, Optional

import chromadb
from chromadb.api.models.Collection import Collection

logger = logging.getLogger(__name__)


class VaultDatabase:
    """
    Unified database class that handles both ChromaDB connection and vault collection management.
    Merges functionality from ChromaClient and CollectionManager.
    """
    
    def __init__(self, persist_directory: str = "./chroma_db"):
        """
        Initialize vault database.
        
        Args:
            persist_directory: Directory for data persistence
        """
        self.persist_directory = Path(persist_directory)
        self._client: Optional[chromadb.PersistentClient] = None
        self._connected = False
    
    async def connect(self, max_retries: int = 3, retry_delay: float = 1.0) -> None:
        """
        Connect to ChromaDB with retry mechanism.
        
        Args:
            max_retries: Maximum connection retry attempts
            retry_delay: Delay between retry attempts in seconds
        """
        last_error = None
        
        for attempt in range(max_retries):
            try:
                # Ensure persist directory exists
                self.persist_directory.mkdir(parents=True, exist_ok=True)
                
                # Create persistent client
                self._client = chromadb.PersistentClient(path=str(self.persist_directory))
                
                # Test connection with heartbeat
                self._client.heartbeat()
                
                self._connected = True
                logger.info(f"Connected to ChromaDB at {self.persist_directory}")
                return
                
            except Exception as e:
                last_error = e
                logger.warning(f"Connection attempt {attempt + 1} failed: {e}")
                
                if attempt < max_retries - 1:
                    await asyncio.sleep(retry_delay)
        
        self._connected = False
        raise ConnectionError(f"Failed to connect to ChromaDB after {max_retries} attempts: {last_error}")
    
    async def disconnect(self) -> None:
        """Disconnect from ChromaDB."""
        if self._client:
            self._client = None
        self._connected = False
        logger.info("Disconnected from ChromaDB")
    
    def is_connected(self) -> bool:
        """Check if client is connected."""
        return self._connected and self._client is not None
    
    def _ensure_connected(self) -> None:
        """Ensure client is connected, raise error if not."""
        if not self.is_connected():
            raise RuntimeError("ChromaDB client is not connected. Call connect() first.")
    
    # Collection management methods (merged from CollectionManager)
    
    def _sanitize_vault_name(self, vault_name: str) -> str:
        """
        Sanitize vault name for collection naming.
        
        Args:
            vault_name: Vault name to sanitize
            
        Returns:
            Sanitized collection name
        """
        # Remove path separators and special characters
        sanitized = re.sub(r'[^a-zA-Z0-9_]', '_', vault_name.lower().replace(' ', '_'))
        sanitized = re.sub(r'_+', '_', sanitized).strip('_')
        return f"vault_{sanitized}"
    
    def _validate_vault_name(self, vault_name: str) -> None:
        """Validate vault name."""
        if not vault_name or not isinstance(vault_name, str):
            raise ValueError("Vault name must be a non-empty string")
        
        if '/' in vault_name or '\\' in vault_name:
            raise ValueError("Vault name cannot contain path separators")
    
    def _is_vault_collection(self, collection) -> bool:
        """Check if collection is a vault collection."""
        return (
            collection.name.startswith("vault_") and 
            hasattr(collection, 'metadata') and
            'vault_name' in (collection.metadata or {})
        )
    
    async def create_vault_collection(
        self,
        vault_name: str,
        vault_path: str,
        description: Optional[str] = None,
        **additional_metadata
    ) -> Collection:
        """
        Create a new vault collection.
        
        Args:
            vault_name: Name of the vault
            vault_path: Path to the vault directory
            description: Optional description
            **additional_metadata: Additional metadata for the collection
            
        Returns:
            Created collection object
        """
        self._ensure_connected()
        self._validate_vault_name(vault_name)
        
        if not vault_path or not isinstance(vault_path, str):
            raise ValueError("Vault path must be a non-empty string")
        
        # Generate collection name
        collection_name = self._sanitize_vault_name(vault_name)
        
        # Prepare metadata
        metadata = {
            "vault_name": vault_name,
            "vault_path": vault_path,
            "collection_type": "vault",
            **additional_metadata
        }
        
        if description:
            metadata["description"] = description
        
        try:
            collection = self._client.create_collection(
                name=collection_name,
                metadata=metadata
            )
            logger.info(f"Created vault collection '{collection_name}' for vault '{vault_name}'")
            return collection
            
        except Exception as e:
            if "already exists" in str(e).lower():
                raise ValueError(f"Vault collection '{vault_name}' already exists")
            raise
    
    async def get_vault_collection(self, vault_name: str) -> Collection:
        """
        Get an existing vault collection.
        
        Args:
            vault_name: Name of the vault
            
        Returns:
            Collection object
        """
        self._ensure_connected()
        collection_name = self._sanitize_vault_name(vault_name)
        
        try:
            collection = self._client.get_collection(collection_name)
            return collection
            
        except Exception as e:
            if "not found" in str(e).lower() or "does not exist" in str(e).lower():
                raise ValueError(f"Vault collection '{vault_name}' not found")
            raise
    
    async def delete_vault_collection(self, vault_name: str) -> bool:
        """
        Delete a vault collection.
        
        Args:
            vault_name: Name of the vault
            
        Returns:
            True if successful
        """
        self._ensure_connected()
        collection_name = self._sanitize_vault_name(vault_name)
        
        try:
            self._client.delete_collection(collection_name)
            logger.info(f"Deleted vault collection '{collection_name}' for vault '{vault_name}'")
            return True
            
        except Exception as e:
            if "not found" in str(e).lower() or "does not exist" in str(e).lower():
                raise ValueError(f"Vault collection '{vault_name}' not found")
            raise
    
    async def list_vault_collections(self) -> List[Dict[str, Any]]:
        """
        List all vault collections.
        
        Returns:
            List of vault collection information
        """
        self._ensure_connected()
        
        try:
            all_collections = self._client.list_collections()
            
            vault_collections = []
            for collection in all_collections:
                if self._is_vault_collection(collection):
                    vault_info = {
                        "name": collection.metadata.get("vault_name"),
                        "collection_name": collection.name,
                        "vault_path": collection.metadata.get("vault_path"),
                        "description": collection.metadata.get("description"),
                        "metadata": collection.metadata
                    }
                    vault_collections.append(vault_info)
            
            return vault_collections
            
        except Exception as e:
            logger.error(f"Failed to list vault collections: {e}")
            raise
    
    async def get_collection_info(self, vault_name: str) -> Dict[str, Any]:
        """
        Get detailed information about a vault collection.
        
        Args:
            vault_name: Name of the vault
            
        Returns:
            Collection information dictionary
        """
        collection = await self.get_vault_collection(vault_name)
        
        # Get document count
        document_count = collection.count()
        
        info = {
            "vault_name": vault_name,
            "collection_name": collection.name,
            "document_count": document_count,
            "vault_path": collection.metadata.get("vault_path"),
            "description": collection.metadata.get("description"),
            "created_at": collection.metadata.get("created_at"),
            "metadata": collection.metadata
        }
        
        return info
    
    async def get_collection_stats(self, vault_name: str) -> Dict[str, Any]:
        """
        Get statistics for a vault collection.
        
        Args:
            vault_name: Name of the vault
            
        Returns:
            Collection statistics dictionary
        """
        collection = await self.get_vault_collection(vault_name)
        
        # Get basic stats
        total_documents = collection.count()
        
        # Get all documents to analyze
        all_docs = collection.get()
        metadatas = all_docs.get('metadatas', [])
        
        # Analyze metadata
        unique_files = set()
        chunk_types = {}
        
        for metadata in metadatas:
            if metadata:
                # Count unique files
                file_path = metadata.get('file_path')
                if file_path:
                    unique_files.add(file_path)
                
                # Count chunk types
                chunk_type = metadata.get('chunk_type', 'unknown')
                chunk_types[chunk_type] = chunk_types.get(chunk_type, 0) + 1
        
        stats = {
            "total_documents": total_documents,
            "unique_files": len(unique_files),
            "chunk_types": chunk_types,
            "collection_name": collection.name,
            "vault_name": vault_name
        }
        
        return stats
    
    async def health_check(self) -> Dict[str, Any]:
        """
        Perform health check on database connection.
        
        Returns:
            Health status information
        """
        if not self.is_connected():
            return {
                'status': 'unhealthy',
                'connected': False,
                'error': 'Not connected to ChromaDB'
            }
        
        try:
            # Test with heartbeat
            heartbeat_result = self._client.heartbeat()
            return {
                'status': 'healthy',
                'connected': True,
                'heartbeat': heartbeat_result,
                'persist_directory': str(self.persist_directory)
            }
        except Exception as e:
            return {
                'status': 'unhealthy',
                'connected': False,
                'error': str(e)
            }