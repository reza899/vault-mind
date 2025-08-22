"""
Collection Manager Service for Vault Mind API.
Handles multi-collection operations, vault management, and coordination between services.
"""
import asyncio
import hashlib
import json
import logging
import os
import time
from pathlib import Path
from typing import Dict, Optional, Any
import sqlite3
from datetime import datetime

from database.providers.chromadb import ChromaDBProvider
from services.job_queue import JobQueue
from services.vault_service import VaultService
from config.config import config

logger = logging.getLogger(__name__)


class CollectionManager:
    """
    Manages multiple ChromaDB collections and vault operations.
    
    Coordinates between VaultService, JobQueue, and ChromaDB for multi-vault support.
    Provides collection-level operations with background job management.
    """
    
    def __init__(self, chroma_provider: ChromaDBProvider, vault_service: VaultService):
        self.chroma_provider = chroma_provider
        self.vault_service = vault_service
        self.job_queue = JobQueue()
        self.settings = config
        
        # Collection metadata storage
        self.metadata_db_path = Path(self.settings.chroma_persist_dir) / "collections_metadata.db"
        self._init_metadata_db()
        
        # Active jobs tracking
        self.active_jobs: Dict[str, Dict] = {}
        
        # Temporary confirmation tokens storage (in production use Redis)
        self._confirmation_tokens: Dict[str, Dict] = {}
        
        # Register job handlers
        self._register_job_handlers()
        
        # Service state
        self._started = False
        
    def _init_metadata_db(self):
        """Initialize SQLite database for collection metadata."""
        self.metadata_db_path.parent.mkdir(parents=True, exist_ok=True)
        
        with sqlite3.connect(self.metadata_db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS collections (
                    name TEXT PRIMARY KEY,
                    vault_path TEXT NOT NULL,
                    description TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_indexed_at TIMESTAMP,
                    document_count INTEGER DEFAULT 0,
                    size_bytes INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'created',
                    config_json TEXT,
                    error_message TEXT,
                    health_status TEXT DEFAULT 'unknown'
                )
            """)
            
            conn.execute("""
                CREATE TABLE IF NOT EXISTS collection_jobs (
                    id TEXT PRIMARY KEY,
                    collection_name TEXT,
                    job_type TEXT,
                    status TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    started_at TIMESTAMP,
                    completed_at TIMESTAMP,
                    progress_data TEXT,
                    error_message TEXT,
                    FOREIGN KEY (collection_name) REFERENCES collections (name)
                )
            """)
            
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_collection_jobs_name ON collection_jobs(collection_name);
            """)
            
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_collection_jobs_status ON collection_jobs(status);
            """)
            
            conn.commit()

    def _register_job_handlers(self):
        """Register job handlers with the job queue."""
        self.job_queue.register_job_handler("create_collection", self._handle_create_collection_job)
        self.job_queue.register_job_handler("reindex_collection", self._handle_reindex_collection_job)
        self.job_queue.register_job_handler("delete_collection", self._handle_delete_collection_job)
        logger.info("Job handlers registered for collection operations")

    async def start(self):
        """Start the collection manager service."""
        if not self._started:
            await self.job_queue.start_queue_processor()
            self._started = True
            logger.info("Collection manager service started")

    async def stop(self):
        """Stop the collection manager service."""
        if self._started:
            await self.job_queue.stop_queue_processor()
            self._started = False
            logger.info("Collection manager service stopped")

    async def _register_vault_collection(
        self,
        collection_name: str,
        vault_path: str,
        description: Optional[str] = None,
        document_count: int = 0,
        status: str = "indexed"
    ) -> None:
        """
        Register a vault collection in the metadata database.
        
        This method is called by VaultService after successful indexing
        to make the collection visible in the collections API.
        
        Args:
            collection_name: Name of the collection
            vault_path: Path to the vault
            description: Optional description
            document_count: Number of documents indexed
            status: Collection status
        """
        try:
            with sqlite3.connect(self.metadata_db_path) as conn:
                # Check if collection already exists
                existing = conn.execute(
                    "SELECT name FROM collections WHERE name = ?",
                    (collection_name,)
                ).fetchone()
                
                if existing:
                    # Calculate size for existing collection
                    calculated_size = await self._calculate_collection_size(collection_name, document_count)
                    
                    # Update existing collection
                    conn.execute("""
                        UPDATE collections SET
                            vault_path = ?,
                            description = ?,
                            updated_at = CURRENT_TIMESTAMP,
                            last_indexed_at = CURRENT_TIMESTAMP,
                            document_count = ?,
                            status = ?,
                            health_status = 'healthy',
                            size_bytes = ?
                        WHERE name = ?
                    """, (vault_path, description, document_count, status, calculated_size, collection_name))
                    logger.info(f"Updated existing collection '{collection_name}' in metadata with size {calculated_size} bytes")
                else:
                    # Calculate size for new collection
                    calculated_size = await self._calculate_collection_size(collection_name, document_count)
                    
                    # Insert new collection
                    conn.execute("""
                        INSERT INTO collections (
                            name, vault_path, description, document_count, 
                            status, health_status, last_indexed_at, size_bytes
                        ) VALUES (?, ?, ?, ?, ?, 'healthy', CURRENT_TIMESTAMP, ?)
                    """, (collection_name, vault_path, description, document_count, status, calculated_size))
                    logger.info(f"Registered new collection '{collection_name}' in metadata with size {calculated_size} bytes")
                
                conn.commit()
                
        except Exception as e:
            logger.error(f"Failed to register collection '{collection_name}': {e}")
            raise

    async def list_collections(self, page: int = 1, limit: int = 50) -> Dict[str, Any]:
        """
        List all collections with metadata and pagination.
        
        Args:
            page: Page number (1-based)
            limit: Items per page (max 100)
            
        Returns:
            Collections list with pagination metadata
        """
        # Validate pagination
        limit = min(limit, 100)
        offset = (page - 1) * limit
        
        try:
            with sqlite3.connect(self.metadata_db_path) as conn:
                conn.row_factory = sqlite3.Row
                
                # Get total count
                total_count = conn.execute(
                    "SELECT COUNT(*) FROM collections"
                ).fetchone()[0]
                
                # Get collections with pagination
                rows = conn.execute("""
                    SELECT name, vault_path, description, created_at, updated_at,
                           last_indexed_at, document_count, size_bytes, status,
                           health_status, error_message
                    FROM collections
                    ORDER BY updated_at DESC
                    LIMIT ? OFFSET ?
                """, (limit, offset)).fetchall()
                
                collections = []
                for row in rows:
                    # Get ChromaDB stats if collection exists
                    chroma_stats = await self._get_collection_chroma_stats(row['name'])
                    logger.info(f"ChromaDB stats for {row['name']}: {chroma_stats}")
                    logger.info(f"Database document_count for {row['name']}: {row['document_count']}")
                    
                    # Use database document_count as source of truth since it's updated correctly
                    final_document_count = row['document_count']
                    logger.info(f"Final document_count for {row['name']}: {final_document_count}")
                    
                    collection_data = {
                        "collection_name": row['name'],
                        "vault_path": row['vault_path'],
                        "description": row['description'],
                        "created_at": row['created_at'],
                        "updated_at": row['updated_at'],
                        "last_indexed_at": row['last_indexed_at'],
                        "document_count": final_document_count,
                        "size_bytes": row['size_bytes'],
                        "status": await self._determine_collection_status(row['name'], row['status']),
                        "health_status": row['health_status'],
                        "error_message": row['error_message'],
                        "chroma_exists": chroma_stats is not None
                    }
                    collections.append(collection_data)
                
                # Calculate pagination
                total_pages = (total_count + limit - 1) // limit
                has_next = page < total_pages
                has_previous = page > 1
                
                return {
                    "collections": collections,
                    "pagination": {
                        "current_page": page,
                        "total_pages": total_pages,
                        "total_items": total_count,
                        "items_per_page": limit,
                        "has_next": has_next,
                        "has_previous": has_previous
                    }
                }
                
        except Exception as e:
            logger.error(f"Error listing collections: {str(e)}", exc_info=True)
            raise

    async def create_collection(
        self,
        collection_name: str,
        vault_path: str,
        description: Optional[str] = None,
        config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Create a new collection from an Obsidian vault.
        
        Args:
            collection_name: Unique collection identifier
            vault_path: Path to Obsidian vault directory
            description: Optional description
            config: Optional configuration overrides
            
        Returns:
            Collection creation result with job ID
            
        Raises:
            ValueError: If collection exists or vault path invalid
        """
        # Validate collection name
        if not self._is_valid_collection_name(collection_name):
            raise ValueError(f"Invalid collection name: {collection_name}")
        
        # Check if collection already exists
        if await self._collection_exists(collection_name):
            raise ValueError(f"Collection '{collection_name}' already exists")
        
        # Validate vault path
        vault_path = os.path.abspath(vault_path)
        if not await self._validate_vault_path(vault_path):
            raise ValueError(f"Invalid vault path or missing .obsidian folder: {vault_path}")
        
        # Estimate indexing time
        estimated_time = await self._estimate_indexing_time(vault_path)
        
        try:
            # Create collection metadata
            config_json = json.dumps(config or {})
            
            with sqlite3.connect(self.metadata_db_path) as conn:
                conn.execute("""
                    INSERT INTO collections (name, vault_path, description, config_json, status)
                    VALUES (?, ?, ?, ?, 'created')
                """, (collection_name, vault_path, description, config_json))
                conn.commit()
            
            # Create indexing job
            job_id = await self.job_queue.create_job(
                job_type="create_collection",
                collection_name=collection_name,
                data={
                    "vault_path": vault_path,
                    "description": description,
                    "config": config or {}
                }
            )
            
            # Job will be processed by the job queue automatically
            
            logger.info(f"Collection creation started: {collection_name} -> {job_id}")
            
            return {
                "collection_id": collection_name,
                "job_id": job_id,
                "status": "indexing_started",
                "estimated_indexing_time": estimated_time
            }
            
        except Exception as e:
            logger.error(f"Error creating collection {collection_name}: {str(e)}", exc_info=True)
            raise

    async def _calculate_collection_size(self, collection_name: str, document_count: int) -> int:
        """Calculate collection size in bytes."""
        try:
            # Get actual ChromaDB collection info
            health_info = await self.chroma_provider.get_collection_health(collection_name)
            actual_count = health_info.get('document_count', 0)
            
            # Estimate size based on document count and typical chunk size
            # Average chunk size: ~500 chars text + 384 floats embedding = ~2KB per chunk
            estimated_size_per_doc = 2048  # 2KB per document/chunk
            
            return max(document_count, actual_count) * estimated_size_per_doc
            
        except Exception as e:
            logger.warning(f"Could not calculate size for {collection_name}: {e}")
            # Fallback: estimate based on provided document count
            return document_count * 2048

    async def delete_collection(self, collection_name: str, confirmation_token: str) -> Dict[str, Any]:
        """
        Delete a collection with confirmation token.
        
        Args:
            collection_name: Collection to delete
            confirmation_token: Token from get_deletion_confirmation
            
        Returns:
            Deletion result with cleanup job ID
            
        Raises:
            ValueError: If collection not found or token invalid
        """
        # Validate collection exists
        if not await self._collection_exists(collection_name):
            raise ValueError(f"Collection '{collection_name}' not found")
        
        # Validate confirmation token
        if not await self._validate_confirmation_token(collection_name, confirmation_token):
            raise ValueError("Invalid or expired confirmation token")
        
        try:
            # Create cleanup job
            job_id = await self.job_queue.create_job(
                job_type="delete_collection",
                collection_name=collection_name,
                data={"confirmation_token": confirmation_token}
            )
            
            # Job will be processed by the job queue automatically
            
            logger.info(f"Collection deletion started: {collection_name} -> {job_id}")
            
            return {
                "status": "deletion_started",
                "cleanup_job_id": job_id,
                "message": f"Collection '{collection_name}' deletion in progress"
            }
            
        except Exception as e:
            logger.error(f"Error deleting collection {collection_name}: {str(e)}", exc_info=True)
            raise

    async def get_deletion_confirmation(self, collection_name: str) -> Dict[str, Any]:
        """
        Get deletion confirmation details and token.
        
        Args:
            collection_name: Collection to delete
            
        Returns:
            Confirmation details with token
        """
        if not await self._collection_exists(collection_name):
            raise ValueError(f"Collection '{collection_name}' not found")
        
        # Get collection info
        collection_info = await self._get_collection_metadata(collection_name)
        chroma_stats = await self._get_collection_chroma_stats(collection_name)
        
        # Generate confirmation token (expires in 5 minutes)
        token_data = f"{collection_name}:{time.time()}"
        confirmation_token = hashlib.sha256(token_data.encode()).hexdigest()[:16]
        
        # Store token temporarily (in memory for simplicity)
        self._store_confirmation_token(collection_name, confirmation_token)
        
        return {
            "collection_name": collection_name,
            "vault_path": collection_info.get('vault_path'),
            "document_count": chroma_stats.get('count', 0) if chroma_stats else 0,
            "size_estimate": collection_info.get('size_bytes', 0),
            "created_at": collection_info.get('created_at'),
            "confirmation_token": confirmation_token,
            "token_expires_in": 300,  # 5 minutes
            "warning": "This action cannot be undone. All indexed data will be permanently deleted."
        }

    # Additional methods continue below...
    # [Rest of implementation for other VMIND-031 requirements]

    def _is_valid_collection_name(self, name: str) -> bool:
        """Validate collection name format."""
        if not name or len(name) > 100:
            return False
        # Allow alphanumeric, underscores, hyphens
        return all(c.isalnum() or c in '_-' for c in name)

    async def _collection_exists(self, collection_name: str) -> bool:
        """Check if collection exists in metadata."""
        with sqlite3.connect(self.metadata_db_path) as conn:
            result = conn.execute(
                "SELECT 1 FROM collections WHERE name = ?",
                (collection_name,)
            ).fetchone()
            return result is not None

    async def _validate_vault_path(self, vault_path: str) -> bool:
        """Validate that vault path exists and has .obsidian folder."""
        path = Path(vault_path)
        if not path.exists() or not path.is_dir():
            return False
        
        obsidian_folder = path / ".obsidian"
        return obsidian_folder.exists()

    async def _estimate_indexing_time(self, vault_path: str) -> Optional[int]:
        """Estimate indexing time based on vault size."""
        try:
            path = Path(vault_path)
            md_files = list(path.rglob("*.md"))
            # Rough estimate: 100 files per minute
            return max(60, len(md_files) * 0.6)  # seconds
        except Exception:
            return None

    async def _determine_collection_status(self, collection_name: str, stored_status: str) -> str:
        """Determine current collection status including active jobs."""
        # Check for active jobs
        active_job = await self.job_queue.get_active_job_for_collection(collection_name)
        if active_job:
            if active_job['job_type'] == 'create_collection':
                return 'indexing'
            elif active_job['job_type'] == 'reindex_collection':
                return 'reindexing'
            elif active_job['job_type'] == 'delete_collection':
                return 'deleting'
        
        return stored_status

    async def _get_collection_chroma_stats(self, collection_name: str) -> Optional[Dict]:
        """Get stats from ChromaDB for collection."""
        try:
            return await self.chroma_provider.get_collection_stats(collection_name)
        except Exception:
            return None

    async def get_collection_status(self, collection_name: str) -> Optional[Dict[str, Any]]:
        """Get detailed status for a collection."""
        if not await self._collection_exists(collection_name):
            return None
        
        try:
            with sqlite3.connect(self.metadata_db_path) as conn:
                conn.row_factory = sqlite3.Row
                row = conn.execute(
                    "SELECT * FROM collections WHERE name = ?",
                    (collection_name,)
                ).fetchone()
                
                if not row:
                    return None
                
                # Get active jobs
                active_job = await self.job_queue.get_active_job_for_collection(collection_name)
                
                status = {
                    "collection_name": collection_name,
                    "status": await self._determine_collection_status(collection_name, row['status']),
                    "document_count": row['document_count'],
                    "last_indexed_at": row['last_indexed_at'],
                    "health_status": row['health_status'],
                    "error_message": row['error_message'],
                    "active_job": active_job
                }
                
                return status
                
        except Exception as e:
            logger.error(f"Error getting collection status: {str(e)}", exc_info=True)
            return None

    async def get_collection_health(self, collection_name: str) -> Optional[Dict[str, Any]]:
        """Get health status for a collection."""
        if not await self._collection_exists(collection_name):
            return None
        
        return await self.chroma_provider.get_collection_health(collection_name)

    async def get_collection_config(self, collection_name: str) -> Optional[Dict[str, Any]]:
        """Get configuration for a collection."""
        if not await self._collection_exists(collection_name):
            return None
        
        try:
            with sqlite3.connect(self.metadata_db_path) as conn:
                conn.row_factory = sqlite3.Row
                row = conn.execute(
                    "SELECT vault_path, config_json FROM collections WHERE name = ?",
                    (collection_name,)
                ).fetchone()
                
                if not row:
                    return None
                
                config = json.loads(row['config_json']) if row['config_json'] else {}
                
                return {
                    "collection_name": collection_name,
                    "vault_path": row['vault_path'],
                    "config": config
                }
                
        except Exception as e:
            logger.error(f"Error getting collection config: {str(e)}", exc_info=True)
            return None

    async def update_collection_config(
        self,
        collection_name: str,
        config_updates: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Update collection configuration."""
        if not await self._collection_exists(collection_name):
            raise ValueError(f"Collection '{collection_name}' not found")
        
        # Get current config
        current_config = await self.get_collection_config(collection_name)
        if not current_config:
            raise ValueError(f"Failed to get current config for '{collection_name}'")
        
        # Merge updates
        updated_config = current_config['config'].copy()
        updated_config.update(config_updates)
        
        # Update in database
        with sqlite3.connect(self.metadata_db_path) as conn:
            conn.execute(
                "UPDATE collections SET config_json = ?, updated_at = ? WHERE name = ?",
                (json.dumps(updated_config), datetime.utcnow().isoformat(), collection_name)
            )
            conn.commit()
        
        return {
            "collection_name": collection_name,
            "updated_config": updated_config,
            "message": "Configuration updated successfully"
        }

    async def reindex_collection(
        self,
        collection_name: str,
        mode: str = "incremental",
        force: bool = False
    ) -> Dict[str, Any]:
        """Trigger re-indexing for a collection."""
        if not await self._collection_exists(collection_name):
            raise ValueError(f"Collection '{collection_name}' not found")
        
        # Check if already indexing
        active_job = await self.job_queue.get_active_job_for_collection(collection_name)
        if active_job and not force:
            raise ValueError("Indexing already in progress")
        
        # Check queue capacity
        stats = await self.job_queue.get_queue_stats()
        if stats['available_slots'] <= 0:
            raise ValueError("Job queue is full")
        
        # Create reindex job
        job_id = await self.job_queue.create_job(
            job_type="reindex_collection",
            collection_name=collection_name,
            data={"mode": mode, "force": force}
        )
        
        return {
            "job_id": job_id,
            "status": "queued",
            "mode": mode
        }

    async def pause_indexing(self, collection_name: str) -> Dict[str, Any]:
        """Pause active indexing for a collection."""
        if not await self._collection_exists(collection_name):
            raise ValueError(f"Collection '{collection_name}' not found")
        
        active_job = await self.job_queue.get_active_job_for_collection(collection_name)
        if not active_job:
            raise ValueError("No active indexing to pause")
        
        success = await self.job_queue.pause_job(active_job['job_id'])
        if not success:
            raise ValueError("Failed to pause indexing")
        
        return {
            "status": "paused",
            "job_id": active_job['job_id']
        }

    async def resume_indexing(self, collection_name: str) -> Dict[str, Any]:
        """Resume paused indexing for a collection."""
        if not await self._collection_exists(collection_name):
            raise ValueError(f"Collection '{collection_name}' not found")
        
        # Find paused job
        jobs = await self.job_queue.get_collection_jobs(collection_name, limit=10)
        paused_job = next((job for job in jobs if job['status'] == 'paused'), None)
        
        if not paused_job:
            raise ValueError("No paused indexing to resume")
        
        success = await self.job_queue.resume_job(paused_job['job_id'])
        if not success:
            raise ValueError("Failed to resume indexing")
        
        return {
            "status": "resumed",
            "job_id": paused_job['job_id']
        }

    async def cancel_indexing(self, collection_name: str) -> Dict[str, Any]:
        """Cancel active indexing for a collection."""
        if not await self._collection_exists(collection_name):
            raise ValueError(f"Collection '{collection_name}' not found")
        
        active_job = await self.job_queue.get_active_job_for_collection(collection_name)
        if not active_job:
            raise ValueError("No active indexing to cancel")
        
        success = await self.job_queue.cancel_job(active_job['job_id'])
        if not success:
            raise ValueError("Failed to cancel indexing")
        
        return {
            "status": "cancelled",
            "job_id": active_job['job_id']
        }

    async def search_collection(
        self,
        collection_name: str,
        query: str,
        filters: Optional[Dict] = None,
        limit: int = 10,
        similarity_threshold: float = 0.4
    ) -> Dict[str, Any]:
        """Search within a collection."""
        if not await self._collection_exists(collection_name):
            raise ValueError(f"Collection '{collection_name}' not found")
        
        # Use ChromaDB provider for search
        results = await self.chroma_provider.query_collection(
            collection_name=collection_name,
            query_texts=[query],
            n_results=limit,
            where=filters
        )
        
        # Format results
        formatted_results = []
        if results.get('documents') and len(results['documents']) > 0:
            documents = results['documents'][0]  # First query results
            metadatas = results.get('metadatas', [{}])[0] if results.get('metadatas') else [{}] * len(documents)
            distances = results.get('distances', [0])[0] if results.get('distances') else [0] * len(documents)
            
            for i, (doc, metadata, distance) in enumerate(zip(documents, metadatas, distances)):
                # Convert distance to similarity score
                similarity = 1 - distance if distance <= 1 else 0
                
                if similarity >= similarity_threshold:
                    formatted_results.append({
                        "content": doc,
                        "metadata": metadata,
                        "similarity_score": similarity,
                        "rank": i + 1
                    })
        
        return {
            "query": query,
            "results": formatted_results,
            "total_results": len(formatted_results),
            "collection_name": collection_name
        }

    def _store_confirmation_token(self, collection_name: str, token: str):
        """Store confirmation token temporarily."""
        expires_at = time.time() + 300  # 5 minutes
        self._confirmation_tokens[token] = {
            "collection_name": collection_name,
            "expires_at": expires_at
        }

    async def _validate_confirmation_token(self, collection_name: str, token: str) -> bool:
        """Validate confirmation token."""
        token_data = self._confirmation_tokens.get(token)
        if not token_data:
            return False
        
        if token_data['collection_name'] != collection_name:
            return False
        
        if time.time() > token_data['expires_at']:
            # Token expired, clean up
            del self._confirmation_tokens[token]
            return False
        
        return True

    async def _get_collection_metadata(self, collection_name: str) -> Dict[str, Any]:
        """Get collection metadata from database."""
        with sqlite3.connect(self.metadata_db_path) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute(
                "SELECT * FROM collections WHERE name = ?",
                (collection_name,)
            ).fetchone()
            
            if row:
                return dict(row)
            return {}

    # Job execution methods - proper handlers for the job queue
    async def _handle_create_collection_job(self, job):
        """Handle collection creation job."""
        collection_name = job.collection_name
        job_data = job.data or {}
        vault_path = job_data.get('vault_path')
        # config = job_data.get('config', {})  # Reserved for future use
        description = job_data.get('description')
        
        try:
            logger.info(f"Starting collection creation job: {job.id} for collection: {collection_name}")
            
            # Update job progress
            await self.job_queue.update_job_progress(job.id, {
                "status": "creating_collection",
                "progress_percentage": 0.0,
                "current_step": "Initializing ChromaDB collection"
            })
            
            # Create ChromaDB collection
            await self.chroma_provider.create_collection(collection_name)
            logger.info(f"ChromaDB collection created: {collection_name}")
            
            # Update progress
            await self.job_queue.update_job_progress(job.id, {
                "status": "indexing_vault",
                "progress_percentage": 20.0,
                "current_step": "Starting vault indexing"
            })
            
            # Use VaultService to index vault
            vault_job_id = await self.vault_service.index_vault(
                vault_name=collection_name,
                vault_path=vault_path,
                description=description,
                force_reindex=False
            )
            
            # Monitor vault indexing progress (simplified - in real implementation would be more sophisticated)
            while True:
                vault_status = await self.vault_service.get_job_status(vault_job_id)
                if not vault_status:
                    break
                    
                if vault_status['status'] == 'completed':
                    # Calculate collection size and get health status
                    document_count = vault_status.get('documents_created', 0)
                    calculated_size = await self._calculate_collection_size(collection_name, document_count)
                    
                    # Determine health status
                    health_status = 'healthy' if document_count > 0 else 'empty'
                    
                    # Update final status
                    with sqlite3.connect(self.metadata_db_path) as conn:
                        conn.execute(
                            "UPDATE collections SET status = ?, last_indexed_at = ?, document_count = ?, size_bytes = ?, health_status = ? WHERE name = ?",
                            ("active", datetime.utcnow().isoformat(), document_count, calculated_size, health_status, collection_name)
                        )
                        conn.commit()
                    
                    await self.job_queue.update_job_progress(job.id, {
                        "status": "completed",
                        "progress_percentage": 100.0,
                        "current_step": "Collection creation completed",
                        "documents_created": vault_status.get('documents_created', 0),
                        "chunks_created": vault_status.get('chunks_created', 0)
                    })
                    
                    logger.info(f"Collection creation completed successfully: {collection_name}")
                    return
                    
                elif vault_status['status'] == 'failed':
                    raise Exception(f"Vault indexing failed: {vault_status.get('error_message', 'Unknown error')}")
                
                else:
                    # Update progress based on vault indexing
                    progress = min(90.0, 20.0 + (vault_status.get('progress_percent', 0) * 0.7))
                    await self.job_queue.update_job_progress(job.id, {
                        "status": "indexing_vault",
                        "progress_percentage": progress,
                        "current_step": f"Indexing: {vault_status.get('current_file', 'Processing files...')}"
                    })
                
                await asyncio.sleep(2)  # Check every 2 seconds
            
        except Exception as e:
            # Mark collection as error state
            with sqlite3.connect(self.metadata_db_path) as conn:
                conn.execute(
                    "UPDATE collections SET status = ?, error_message = ? WHERE name = ?",
                    ("error", str(e), collection_name)
                )
                conn.commit()
            
            logger.error(f"Collection creation failed: {collection_name} - {str(e)}")
            raise

    async def _handle_reindex_collection_job(self, job):
        """Handle collection reindexing job."""
        collection_name = job.collection_name
        job_data = job.data or {}
        mode = job_data.get('mode', 'incremental')
        # force = job_data.get('force', False)  # Reserved for future use
        
        try:
            logger.info(f"Starting collection reindex job: {job.id} for collection: {collection_name}")
            
            # Get collection metadata
            collection_metadata = await self._get_collection_metadata(collection_name)
            if not collection_metadata:
                raise ValueError(f"Collection metadata not found: {collection_name}")
            
            vault_path = collection_metadata.get('vault_path')
            if not vault_path:
                raise ValueError(f"Vault path not found for collection: {collection_name}")
            
            # Update job progress
            await self.job_queue.update_job_progress(job.id, {
                "status": "reindexing",
                "progress_percentage": 0.0,
                "current_step": f"Starting {mode} reindex"
            })
            
            # Use VaultService to reindex vault
            # For reindexing operations, always allow overwriting existing vaults
            vault_job_id = await self.vault_service.index_vault(
                vault_name=collection_name,
                vault_path=vault_path,
                force_reindex=True  # Always force reindex for reindex operations
            )
            
            # Monitor vault reindexing progress
            while True:
                vault_status = await self.vault_service.get_job_status(vault_job_id)
                if not vault_status:
                    break
                    
                if vault_status['status'] == 'completed':
                    # Debug: Log vault status to understand the issue
                    logger.info(f"Vault status for {collection_name}: {vault_status}")
                    
                    # Calculate collection size and get health status  
                    document_count = vault_status.get('documents_created', 0)
                    logger.info(f"Document count for {collection_name}: {document_count}")
                    
                    calculated_size = await self._calculate_collection_size(collection_name, document_count)
                    
                    # Determine health status
                    health_status = 'healthy' if document_count > 0 else 'empty'
                    
                    # Update final status
                    try:
                        with sqlite3.connect(self.metadata_db_path) as conn:
                            cursor = conn.execute(
                                "UPDATE collections SET status = ?, last_indexed_at = ?, document_count = ?, updated_at = ?, size_bytes = ?, health_status = ? WHERE name = ?",
                                ("active", datetime.utcnow().isoformat(), document_count, 
                                 datetime.utcnow().isoformat(), calculated_size, health_status, collection_name)
                            )
                            rows_affected = cursor.rowcount
                            conn.commit()
                            logger.info(f"Database update for {collection_name}: {rows_affected} rows affected")
                            
                            # Verify the update worked
                            cursor = conn.execute("SELECT document_count, size_bytes, health_status FROM collections WHERE name = ?", (collection_name,))
                            result = cursor.fetchone()
                            if result:
                                logger.info(f"Verified database values for {collection_name}: document_count={result[0]}, size_bytes={result[1]}, health_status={result[2]}")
                            else:
                                logger.error(f"No record found for collection {collection_name} after update")
                    except Exception as e:
                        logger.error(f"Database update failed for {collection_name}: {e}")
                    
                    await self.job_queue.update_job_progress(job.id, {
                        "status": "completed",
                        "progress_percentage": 100.0,
                        "current_step": "Reindexing completed",
                        "documents_updated": vault_status.get('documents_created', 0)
                    })
                    
                    logger.info(f"Collection reindexing completed: {collection_name}")
                    return
                    
                elif vault_status['status'] == 'failed':
                    raise Exception(f"Vault reindexing failed: {vault_status.get('error_message', 'Unknown error')}")
                
                else:
                    # Update progress
                    await self.job_queue.update_job_progress(job.id, {
                        "status": "reindexing",
                        "progress_percentage": vault_status.get('progress_percent', 0),
                        "current_step": f"Reindexing: {vault_status.get('current_file', 'Processing files...')}"
                    })
                
                await asyncio.sleep(2)
            
        except Exception as e:
            # Mark collection as error state
            with sqlite3.connect(self.metadata_db_path) as conn:
                conn.execute(
                    "UPDATE collections SET status = ?, error_message = ? WHERE name = ?",
                    ("error", str(e), collection_name)
                )
                conn.commit()
            
            logger.error(f"Collection reindexing failed: {collection_name} - {str(e)}")
            raise

    async def _handle_delete_collection_job(self, job):
        """Handle collection deletion job."""
        collection_name = job.collection_name
        
        try:
            logger.info(f"Starting collection deletion job: {job.id} for collection: {collection_name}")
            
            # Update job progress
            await self.job_queue.update_job_progress(job.id, {
                "status": "deleting",
                "progress_percentage": 0.0,
                "current_step": "Deleting ChromaDB collection"
            })
            
            # Delete ChromaDB collection
            await self.chroma_provider.delete_collection(collection_name)
            logger.info(f"ChromaDB collection deleted: {collection_name}")
            
            # Update progress
            await self.job_queue.update_job_progress(job.id, {
                "status": "cleaning_metadata",
                "progress_percentage": 80.0,
                "current_step": "Cleaning metadata"
            })
            
            # Remove metadata
            with sqlite3.connect(self.metadata_db_path) as conn:
                conn.execute("DELETE FROM collections WHERE name = ?", (collection_name,))
                conn.execute("DELETE FROM collection_jobs WHERE collection_name = ?", (collection_name,))
                conn.commit()
            
            # Final progress update
            await self.job_queue.update_job_progress(job.id, {
                "status": "completed",
                "progress_percentage": 100.0,
                "current_step": "Collection deletion completed"
            })
            
            logger.info(f"Collection deletion completed: {collection_name}")
            
        except Exception as e:
            logger.error(f"Collection deletion failed: {collection_name} - {str(e)}")
            raise