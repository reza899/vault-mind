"""
Vault Service - Business logic coordination layer.
Orchestrates VaultDatabase, EmbeddingService, and Indexer operations.
"""
import asyncio
import logging
import time
import uuid
from pathlib import Path
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime

from database import VaultDatabase, EmbeddingService
from indexer.enhanced_parser import EnhancedMarkdownParser
from indexer.text_chunker import TextChunker
from indexer.file_tracker import FileChangeTracker
from services.link_graph_manager import LinkGraphManager
from services.metadata_enhancer import MetadataEnhancer

logger = logging.getLogger(__name__)


class IndexingJob:
    """Represents an active indexing job with progress tracking."""
    
    def __init__(self, job_id: str, vault_name: str, vault_path: str):
        self.job_id = job_id
        self.vault_name = vault_name
        self.vault_path = vault_path
        self.status = "queued"  # queued, running, completed, failed
        self.progress_percent = 0.0
        self.files_processed = 0
        self.total_files = 0
        self.started_at = datetime.now()
        self.completed_at: Optional[datetime] = None
        self.error_message: Optional[str] = None
        self.current_file: Optional[str] = None
        self.documents_created = 0
        self.chunks_created = 0
        
    def to_dict(self) -> Dict[str, Any]:
        """Convert job to dictionary representation."""
        return {
            "job_id": self.job_id,
            "vault_name": self.vault_name,
            "vault_path": self.vault_path,
            "status": self.status,
            "progress_percent": self.progress_percent,
            "files_processed": self.files_processed,
            "total_files": self.total_files,
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "error_message": self.error_message,
            "current_file": self.current_file,
            "documents_created": self.documents_created,
            "chunks_created": self.chunks_created
        }


class VaultService:
    """
    Service layer that coordinates vault operations.
    Integrates database, embedding, and indexing components.
    """
    
    def __init__(self, database: VaultDatabase, embedding_service: EmbeddingService):
        """
        Initialize vault service.
        
        Args:
            database: VaultDatabase instance
            embedding_service: EmbeddingService instance
        """
        self.database = database
        self.embedding_service = embedding_service
        self.parser = EnhancedMarkdownParser()
        self.chunker = TextChunker()
        self.file_tracker = FileChangeTracker()
        self.link_graph = LinkGraphManager()
        self.metadata_enhancer = MetadataEnhancer()
        
        # Active jobs tracking
        self.active_jobs: Dict[str, IndexingJob] = {}
        self.job_history: List[IndexingJob] = []
        
        # Progress callbacks
        self.progress_callbacks: List[Callable[[str, Dict[str, Any]], None]] = []
        
    def add_progress_callback(self, callback: Callable[[str, Dict[str, Any]], None]) -> None:
        """Add a progress callback function."""
        self.progress_callbacks.append(callback)
        
    def remove_progress_callback(self, callback: Callable[[str, Dict[str, Any]], None]) -> None:
        """Remove a progress callback function."""
        if callback in self.progress_callbacks:
            self.progress_callbacks.remove(callback)
    
    def _notify_progress(self, event_type: str, data: Dict[str, Any]) -> None:
        """Notify all progress callbacks of an event."""
        for callback in self.progress_callbacks:
            try:
                callback(event_type, data)
            except Exception as e:
                logger.error(f"Progress callback error: {e}")
    
    async def index_vault(
        self,
        vault_name: str,
        vault_path: str,
        description: Optional[str] = None,
        force_reindex: bool = False
    ) -> str:
        """
        Start vault indexing operation.
        
        Args:
            vault_name: Unique vault identifier
            vault_path: Filesystem path to vault
            description: Optional vault description
            force_reindex: Whether to force re-indexing
            
        Returns:
            Job ID for tracking progress
        """
        # Validate inputs
        self._validate_vault_inputs(vault_name, vault_path)
        
        # Check if vault already exists
        if not force_reindex:
            try:
                await self.database.get_vault_collection(vault_name)
                raise ValueError(f"Vault '{vault_name}' already exists. Use force_reindex=True to overwrite.")
            except ValueError as e:
                if "already exists" in str(e):
                    raise
                # Vault doesn't exist, continue with indexing
        
        # Create indexing job
        job_id = str(uuid.uuid4())
        job = IndexingJob(job_id, vault_name, vault_path)
        self.active_jobs[job_id] = job
        
        # Start background indexing
        asyncio.create_task(self._process_vault_indexing(job, description, force_reindex))
        
        logger.info(f"Started indexing job {job_id} for vault '{vault_name}'")
        
        # Notify job started
        self._notify_progress("indexing_started", {
            "job_id": job_id,
            "vault_name": vault_name,
            "vault_path": vault_path
        })
        
        return job_id
    
    async def _process_vault_indexing(
        self,
        job: IndexingJob,
        description: Optional[str],
        force_reindex: bool
    ) -> None:
        """Process vault indexing in background."""
        try:
            job.status = "running"
            logger.info(f"Processing vault indexing for job {job.job_id}")
            
            # Scan vault for files
            vault_path = Path(job.vault_path)
            markdown_files = list(vault_path.rglob("*.md"))
            job.total_files = len(markdown_files)
            
            if job.total_files == 0:
                raise ValueError(f"No markdown files found in vault: {job.vault_path}")
            
            # Create or get vault collection
            if force_reindex:
                try:
                    await self.database.delete_vault_collection(job.vault_name)
                except ValueError:
                    pass  # Collection didn't exist
            
            collection = await self.database.create_vault_collection(
                vault_name=job.vault_name,
                vault_path=job.vault_path,
                description=description
            )
            
            # Process files in batches
            batch_size = 10
            all_documents = []
            all_embeddings = []
            all_metadatas = []
            all_ids = []
            
            for i, file_path in enumerate(markdown_files):
                try:
                    job.current_file = str(file_path)
                    job.files_processed = i + 1
                    job.progress_percent = (job.files_processed / job.total_files) * 100
                    
                    # Parse file
                    parsed_data = self.parser.parse_file(file_path)
                    
                    # Chunk content
                    chunks = self.chunker.chunk_text(parsed_data['content'])
                    
                    # Process each chunk
                    for chunk_idx, chunk in enumerate(chunks):
                        # Prepare base document metadata
                        base_metadata = {
                            'file_path': str(file_path),
                            'vault_name': job.vault_name,
                            'chunk_index': chunk_idx,
                            'total_chunks': len(chunks),
                            'chunk_type': 'text',
                            'indexed_at': datetime.now().isoformat(),
                            'start_char': chunk.get('start_char', 0),
                            'end_char': chunk.get('end_char', 0),
                            **parsed_data['metadata']
                        }
                        
                        # Enhance metadata for better storage and search
                        doc_metadata = self.metadata_enhancer.enhance_metadata(
                            base_metadata, 
                            chunk['text']
                        )
                        
                        # Generate unique ID
                        doc_id = f"{job.vault_name}_{file_path.stem}_{chunk_idx}"
                        
                        all_documents.append(chunk['text'])
                        all_metadatas.append(doc_metadata)
                        all_ids.append(doc_id)
                        job.chunks_created += 1
                    
                    job.documents_created += 1
                    
                    # Process batch if reached batch size
                    if len(all_documents) >= batch_size:
                        await self._process_document_batch(
                            collection, all_documents, all_metadatas, all_ids
                        )
                        all_documents.clear()
                        all_embeddings.clear()
                        all_metadatas.clear()
                        all_ids.clear()
                    
                    # Notify progress
                    if i % 5 == 0 or i == len(markdown_files) - 1:
                        self._notify_progress("indexing_progress", {
                            "job_id": job.job_id,
                            "vault_name": job.vault_name,
                            "files_processed": job.files_processed,
                            "total_files": job.total_files,
                            "current_file": job.current_file,
                            "progress_percent": job.progress_percent,
                            "chunks_created": job.chunks_created
                        })
                    
                except Exception as e:
                    logger.error(f"Error processing file {file_path}: {e}")
                    # Continue with other files
                    continue
            
            # Process remaining documents
            if all_documents:
                await self._process_document_batch(
                    collection, all_documents, all_metadatas, all_ids
                )
            
            # Build link graph after all documents are processed
            await self._build_vault_link_graph(job.vault_name, collection)
            
            # Mark job as completed
            job.status = "completed"
            job.completed_at = datetime.now()
            job.progress_percent = 100.0
            job.current_file = None
            
            logger.info(f"Completed indexing job {job.job_id}: {job.documents_created} documents, {job.chunks_created} chunks")
            
            # Notify completion
            self._notify_progress("indexing_completed", {
                "job_id": job.job_id,
                "vault_name": job.vault_name,
                "total_processed": job.documents_created,
                "duration_seconds": (job.completed_at - job.started_at).total_seconds(),
                "documents_created": job.documents_created,
                "chunks_created": job.chunks_created
            })
            
        except Exception as e:
            job.status = "failed"
            job.error_message = str(e)
            job.completed_at = datetime.now()
            
            logger.error(f"Indexing job {job.job_id} failed: {e}")
            
            # Notify error
            self._notify_progress("indexing_error", {
                "job_id": job.job_id,
                "vault_name": job.vault_name,
                "error_message": str(e),
                "failed_file": job.current_file
            })
        
        finally:
            # Move job to history
            if job.job_id in self.active_jobs:
                self.job_history.append(self.active_jobs.pop(job.job_id))
                
                # Keep only last 100 jobs in history
                if len(self.job_history) > 100:
                    self.job_history = self.job_history[-100:]
    
    async def _process_document_batch(
        self,
        collection,
        documents: List[str],
        metadatas: List[Dict[str, Any]],
        ids: List[str]
    ) -> None:
        """Process a batch of documents for embedding and storage."""
        # Generate embeddings
        embeddings = await self.embedding_service.encode_texts(documents)
        
        # Metadata is already enhanced and sanitized by MetadataEnhancer
        # Store in ChromaDB
        collection.add(
            documents=documents,
            embeddings=embeddings,
            metadatas=metadatas,
            ids=ids
        )
    
    async def search_vault(
        self,
        vault_name: str,
        query: str,
        limit: int = 10,
        similarity_threshold: float = 0.7,
        include_context: bool = True,
        tag_filters: Optional[Dict[str, List[str]]] = None
    ) -> Dict[str, Any]:
        """
        Search vault with semantic similarity.
        
        Args:
            vault_name: Target vault name
            query: Search query
            limit: Maximum results
            similarity_threshold: Minimum similarity score
            include_context: Include surrounding context
            tag_filters: Optional tag filtering dict with 'include_tags' and 'exclude_tags' lists
            
        Returns:
            Search results with metadata
        """
        start_time = time.time()
        
        # Get vault collection
        collection = await self.database.get_vault_collection(vault_name)
        
        # Generate query embedding
        query_embedding = await self.embedding_service.encode_text(query)
        
        # Perform similarity search
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=min(limit * 2, 100),  # Get extra results for filtering
            include=['documents', 'metadatas', 'distances']
        )
        
        # Process and filter results
        processed_results = []
        for i, (doc, metadata, distance) in enumerate(zip(
            results['documents'][0],
            results['metadatas'][0], 
            results['distances'][0]
        )):
            similarity_score = 1 - distance  # Convert distance to similarity
            
            if similarity_score >= similarity_threshold:
                # Apply tag filtering if specified
                if tag_filters and not self._matches_tag_filters(metadata, tag_filters):
                    continue
                    
                result = {
                    'id': results['ids'][0][i],
                    'content': doc,
                    'similarity_score': similarity_score,
                    'metadata': metadata
                }
                
                if include_context:
                    result['context'] = await self._get_context(collection, results['ids'][0][i], metadata)
                
                processed_results.append(result)
        
        # Sort by similarity and limit results
        processed_results.sort(key=lambda x: x['similarity_score'], reverse=True)
        processed_results = processed_results[:limit]
        
        search_time_ms = (time.time() - start_time) * 1000
        
        # Get vault info
        vault_info = await self.database.get_collection_info(vault_name)
        
        return {
            'results': processed_results,
            'total_found': len(processed_results),
            'search_time_ms': search_time_ms,
            'vault_info': vault_info
        }
    
    def _matches_tag_filters(self, metadata: Dict[str, Any], tag_filters: Dict[str, List[str]]) -> bool:
        """Check if document metadata matches tag filtering criteria."""
        content_tags = metadata.get('content_tags', [])
        frontmatter_tags = metadata.get('tags', [])  # From frontmatter
        
        # Combine all tags from the document
        all_tags = list(set(content_tags + frontmatter_tags))
        
        # Check include tags (document must have at least one of these tags)
        include_tags = tag_filters.get('include_tags', [])
        if include_tags:
            has_included_tag = any(
                any(tag.lower().startswith(filter_tag.lower()) or filter_tag.lower() in tag.lower() 
                    for tag in all_tags)
                for filter_tag in include_tags
            )
            if not has_included_tag:
                return False
        
        # Check exclude tags (document must not have any of these tags)
        exclude_tags = tag_filters.get('exclude_tags', [])
        if exclude_tags:
            has_excluded_tag = any(
                any(tag.lower().startswith(filter_tag.lower()) or filter_tag.lower() in tag.lower() 
                    for tag in all_tags)
                for filter_tag in exclude_tags
            )
            if has_excluded_tag:
                return False
        
        return True
    
    async def get_vault_tags(self, vault_name: str, limit: int = 100) -> Dict[str, Any]:
        """Get all tags from a vault with usage frequency."""
        # Get vault collection
        collection = await self.database.get_vault_collection(vault_name)
        
        # Get all documents with metadata
        all_docs = collection.get(include=['metadatas'])
        
        # Count tag frequencies
        tag_counts = {}
        tag_types = {}  # Track whether tag is from content or frontmatter
        
        for metadata in all_docs['metadatas']:
            # Process content tags (hashtags)
            content_tags = metadata.get('content_tags', [])
            for tag in content_tags:
                tag_counts[tag] = tag_counts.get(tag, 0) + 1
                tag_types[tag] = 'content'
            
            # Process frontmatter tags
            frontmatter_tags = metadata.get('tags', [])
            if isinstance(frontmatter_tags, list):
                for tag in frontmatter_tags:
                    tag_counts[tag] = tag_counts.get(tag, 0) + 1
                    if tag not in tag_types:  # Content tags take precedence
                        tag_types[tag] = 'frontmatter'
        
        # Sort tags by frequency and limit results
        sorted_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)[:limit]
        
        # Format results
        tags = [
            {
                'name': tag,
                'frequency': count,
                'type': tag_types.get(tag, 'unknown')
            }
            for tag, count in sorted_tags
        ]
        
        return {
            'tags': tags,
            'total_tags': len(tag_counts)
        }
    
    async def _get_context(
        self, 
        collection, 
        doc_id: str, 
        metadata: Dict[str, Any]
    ) -> Optional[Dict[str, str]]:
        """Get surrounding context for a search result."""
        try:
            file_path = metadata.get('file_path')
            chunk_index = metadata.get('chunk_index', 0)
            
            if not file_path:
                return None
            
            # Try to get adjacent chunks for context
            context = {}
            
            # Get previous chunk
            prev_id = f"{metadata.get('vault_name')}_{Path(file_path).stem}_{chunk_index - 1}"
            try:
                prev_result = collection.get(ids=[prev_id], include=['documents'])
                if prev_result['documents']:
                    context['before'] = prev_result['documents'][0][:200] + "..."
            except Exception:
                pass
            
            # Get next chunk  
            next_id = f"{metadata.get('vault_name')}_{Path(file_path).stem}_{chunk_index + 1}"
            try:
                next_result = collection.get(ids=[next_id], include=['documents'])
                if next_result['documents']:
                    context['after'] = "..." + next_result['documents'][0][-200:]
            except Exception:
                pass
            
            return context if context else None
            
        except Exception as e:
            logger.warning(f"Failed to get context for {doc_id}: {e}")
            return None
    
    async def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a specific job."""
        # Check active jobs
        if job_id in self.active_jobs:
            return self.active_jobs[job_id].to_dict()
        
        # Check job history
        for job in self.job_history:
            if job.job_id == job_id:
                return job.to_dict()
        
        return None
    
    async def get_all_jobs(self) -> Dict[str, Any]:
        """Get all active and recent jobs."""
        active = [job.to_dict() for job in self.active_jobs.values()]
        recent = [job.to_dict() for job in self.job_history[-20:]]  # Last 20 jobs
        
        return {
            'active_jobs': active,
            'recent_jobs': recent,
            'total_active': len(active),
            'total_history': len(self.job_history)
        }
    
    async def get_vault_collections(self) -> List[Dict[str, Any]]:
        """Get list of all vault collections."""
        return await self.database.list_vault_collections()
    
    async def get_system_status(self) -> Dict[str, Any]:
        """Get overall system status."""
        # Database health
        db_health = await self.database.health_check()
        
        # Embedding service health
        embed_health = await self.embedding_service.health_check()
        
        # Collection statistics
        collections = await self.database.list_vault_collections()
        total_collections = len(collections)
        total_documents = sum(
            collection.get('document_count', 0) for collection in collections
        )
        
        # Active jobs count
        active_jobs_count = len(self.active_jobs)
        
        return {
            'database_health': db_health,
            'embedding_service_health': embed_health,
            'total_collections': total_collections,
            'total_documents': total_documents,
            'active_jobs': active_jobs_count,
            'service_status': 'healthy' if db_health['status'] == 'healthy' and embed_health['status'] == 'healthy' else 'unhealthy'
        }
    
    def _sanitize_metadatas(self, metadatas: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Sanitize metadata to ensure ChromaDB compatibility.
        
        ChromaDB only accepts str, int, float, bool, or None as metadata values.
        Lists and other complex types need to be converted.
        """
        sanitized = []
        
        for metadata in metadatas:
            sanitized_metadata = {}
            
            for key, value in metadata.items():
                if value is None or isinstance(value, (str, int, float, bool)):
                    # Already compatible types
                    sanitized_metadata[key] = value
                elif isinstance(value, list):
                    # Convert lists to comma-separated strings
                    if all(isinstance(item, (str, int, float, bool)) for item in value):
                        sanitized_metadata[key] = ", ".join(map(str, value))
                    else:
                        # Skip complex list items
                        sanitized_metadata[key] = f"list_{len(value)}_items"
                elif isinstance(value, dict):
                    # Convert dicts to strings (simplified representation)
                    sanitized_metadata[key] = f"dict_{len(value)}_keys"
                else:
                    # Convert other types to string
                    sanitized_metadata[key] = str(value)
            
            sanitized.append(sanitized_metadata)
        
        return sanitized

    def _validate_vault_inputs(self, vault_name: str, vault_path: str) -> None:
        """Validate vault inputs."""
        if not vault_name or not isinstance(vault_name, str):
            raise ValueError("Vault name must be a non-empty string")
        
        if len(vault_name) > 100:
            raise ValueError("Vault name too long (max 100 characters)")
        
        if not vault_name.replace('_', '').replace('-', '').isalnum():
            raise ValueError("Vault name can only contain alphanumeric characters, underscores, and hyphens")
        
        if not vault_path or not isinstance(vault_path, str):
            raise ValueError("Vault path must be a non-empty string")
        
        path = Path(vault_path)
        if not path.exists():
            raise ValueError(f"Vault path does not exist: {vault_path}")
        
        if not path.is_dir():
            raise ValueError(f"Vault path is not a directory: {vault_path}")
    
    async def _build_vault_link_graph(self, vault_name: str, collection) -> None:
        """Build the link graph for a vault using collected metadata."""
        try:
            logger.info(f"Building link graph for vault '{vault_name}'")
            
            # Get all documents with metadata from the collection
            all_docs = collection.get(include=['metadatas'])
            
            if not all_docs or not all_docs['metadatas']:
                logger.warning(f"No documents found for link graph building in vault '{vault_name}'")
                return
            
            # Collect unique document metadata (one per file)
            documents_metadata = []
            processed_files = set()
            
            for metadata in all_docs['metadatas']:
                # Ensure metadata is a dictionary and not None or string
                if not isinstance(metadata, dict):
                    continue
                    
                file_path = metadata.get('file_path')
                if file_path and file_path not in processed_files:
                    # Only include metadata with link information
                    if metadata.get('links'):
                        documents_metadata.append(metadata)
                        processed_files.add(file_path)
            
            if not documents_metadata:
                logger.warning(f"No documents with link metadata found in vault '{vault_name}'")
                return
            
            # Build the graph using LinkGraphManager
            self.link_graph.build_vault_graph(vault_name, documents_metadata)
            
            logger.info(f"Successfully built link graph for vault '{vault_name}' with {len(documents_metadata)} documents")
            
        except Exception as e:
            logger.error(f"Failed to build link graph for vault '{vault_name}': {e}")
    
    async def get_vault_link_graph_stats(self, vault_name: str) -> Dict[str, Any]:
        """Get link graph statistics for a vault."""
        return self.link_graph.get_graph_stats(vault_name)
    
    async def get_vault_backlinks(self, vault_name: str, note_name: str) -> List[Dict[str, Any]]:
        """Get backlinks for a specific note in a vault."""
        return self.link_graph.get_backlinks(vault_name, note_name)
    
    async def get_vault_outgoing_links(self, vault_name: str, note_name: str) -> List[Dict[str, Any]]:
        """Get outgoing links for a specific note in a vault."""
        return self.link_graph.get_outgoing_links(vault_name, note_name)
    
    async def get_connected_notes(self, vault_name: str, note_name: str, max_distance: int = 2) -> Dict[str, Any]:
        """Get notes connected to a specific note within the given distance."""
        return self.link_graph.get_connected_notes(vault_name, note_name, max_distance)
    
    async def get_most_linked_notes(self, vault_name: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get the most linked notes in a vault."""
        return self.link_graph.get_most_linked_notes(vault_name, limit)
    
    async def get_hub_notes(self, vault_name: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get hub notes (notes with most outgoing links) in a vault."""
        return self.link_graph.get_hub_notes(vault_name, limit)
    
    async def find_orphan_notes(self, vault_name: str) -> List[str]:
        """Find orphan notes (notes with no links) in a vault."""
        return self.link_graph.find_orphan_notes(vault_name)
    
    async def get_link_suggestions(self, vault_name: str, note_name: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Get link suggestions for a note based on graph analysis."""
        return self.link_graph.get_link_suggestions(vault_name, note_name, limit)
    
    async def incremental_update(
        self, 
        vault_name: str, 
        changes: Dict[str, List[str]]
    ) -> Dict[str, Any]:
        """
        Perform incremental update based on file changes.
        
        Args:
            vault_name: Target vault name
            changes: Dict with 'added', 'modified', 'deleted' file lists
            
        Returns:
            Update statistics and results
        """
        try:
            logger.info(f"Starting incremental update for vault '{vault_name}'")
            
            # Get vault collection
            collection = await self.database.get_vault_collection(vault_name)
            
            stats = {
                'vault_name': vault_name,
                'files_processed': 0,
                'documents_added': 0,
                'documents_updated': 0,
                'documents_deleted': 0,
                'chunks_created': 0,
                'chunks_updated': 0,
                'chunks_deleted': 0,
                'errors': [],
                'start_time': datetime.now(),
                'end_time': None
            }
            
            # Process deletions first
            await self._process_file_deletions(collection, vault_name, changes.get('deleted', []), stats)
            
            # Process additions and modifications
            all_changed_files = changes.get('added', []) + changes.get('modified', [])
            await self._process_file_updates(collection, vault_name, all_changed_files, stats)
            
            # Rebuild link graph if any files changed
            if any(changes.values()):
                await self._build_vault_link_graph(vault_name, collection)
                logger.info(f"Rebuilt link graph for vault '{vault_name}'")
            
            stats['end_time'] = datetime.now()
            stats['duration_seconds'] = (stats['end_time'] - stats['start_time']).total_seconds()
            
            logger.info(f"Incremental update completed for vault '{vault_name}': "
                       f"{stats['files_processed']} files, "
                       f"{stats['documents_added']} docs added, "
                       f"{stats['documents_updated']} docs updated, "
                       f"{stats['documents_deleted']} docs deleted")
            
            return stats
            
        except Exception as e:
            logger.error(f"Incremental update failed for vault '{vault_name}': {e}")
            raise
    
    async def _process_file_deletions(
        self, 
        collection, 
        vault_name: str, 
        deleted_files: List[str], 
        stats: Dict[str, Any]
    ) -> None:
        """Process file deletions by removing associated documents."""
        for file_path in deleted_files:
            try:
                # Find all document IDs for this file
                file_docs = collection.get(
                    where={"file_path": file_path},
                    include=['ids']
                )
                
                if file_docs and file_docs['ids']:
                    # Delete all chunks for this file
                    collection.delete(ids=file_docs['ids'])
                    
                    stats['documents_deleted'] += 1
                    stats['chunks_deleted'] += len(file_docs['ids'])
                    
                    logger.debug(f"Deleted {len(file_docs['ids'])} chunks for file: {file_path}")
                
            except Exception as e:
                error_msg = f"Error deleting file {file_path}: {e}"
                logger.error(error_msg)
                stats['errors'].append(error_msg)
    
    async def _process_file_updates(
        self, 
        collection, 
        vault_name: str, 
        changed_files: List[str], 
        stats: Dict[str, Any]
    ) -> None:
        """Process file additions and modifications."""
        batch_size = 10
        all_documents = []
        all_metadatas = []
        all_ids = []
        
        for file_path in changed_files:
            try:
                file_path_obj = Path(file_path)
                
                # Check if file still exists (might have been deleted between detection and processing)
                if not file_path_obj.exists():
                    logger.warning(f"File no longer exists, skipping: {file_path}")
                    continue
                
                # Check if this is a modification (file already indexed)
                existing_docs = collection.get(
                    where={"file_path": file_path},
                    include=['ids']
                )
                
                is_modification = bool(existing_docs and existing_docs['ids'])
                
                if is_modification:
                    # Delete existing chunks for this file
                    collection.delete(ids=existing_docs['ids'])
                    stats['chunks_deleted'] += len(existing_docs['ids'])
                    logger.debug(f"Removed {len(existing_docs['ids'])} existing chunks for: {file_path}")
                
                # Parse the file
                parsed_data = self.parser.parse_file(file_path_obj)
                
                # Chunk the content
                chunks = self.chunker.chunk_text(parsed_data['content'])
                
                # Process each chunk
                for chunk_idx, chunk in enumerate(chunks):
                    # Prepare base document metadata
                    base_metadata = {
                        'file_path': str(file_path_obj),
                        'vault_name': vault_name,
                        'chunk_index': chunk_idx,
                        'total_chunks': len(chunks),
                        'chunk_type': 'text',
                        'indexed_at': datetime.now().isoformat(),
                        'start_char': chunk.get('start_char', 0),
                        'end_char': chunk.get('end_char', 0),
                        **parsed_data['metadata']
                    }
                    
                    # Enhance metadata for better storage and search
                    doc_metadata = self.metadata_enhancer.enhance_metadata(
                        base_metadata, 
                        chunk['text']
                    )
                    
                    # Generate unique ID
                    doc_id = f"{vault_name}_{file_path_obj.stem}_{chunk_idx}"
                    
                    all_documents.append(chunk['text'])
                    all_metadatas.append(doc_metadata)
                    all_ids.append(doc_id)
                    stats['chunks_created'] += 1
                
                # Update statistics
                if is_modification:
                    stats['documents_updated'] += 1
                else:
                    stats['documents_added'] += 1
                
                stats['files_processed'] += 1
                
                # Process batch if reached batch size
                if len(all_documents) >= batch_size:
                    await self._process_document_batch(
                        collection, all_documents, all_metadatas, all_ids
                    )
                    all_documents.clear()
                    all_metadatas.clear()
                    all_ids.clear()
                
            except Exception as e:
                error_msg = f"Error processing file {file_path}: {e}"
                logger.error(error_msg)
                stats['errors'].append(error_msg)
        
        # Process remaining documents
        if all_documents:
            await self._process_document_batch(
                collection, all_documents, all_metadatas, all_ids
            )
    
    async def setup_incremental_updates(self, vault_name: str, vault_path: str) -> None:
        """
        Set up incremental updates for a vault using the file change service.
        This connects the file change detection to automatic incremental updates.
        """
        try:
            # Import here to avoid circular dependency
            from services.file_change_service import get_file_change_service
            
            file_change_service = get_file_change_service()
            
            # Add vault to file change monitoring
            await file_change_service.add_vault_watch(
                vault_name=vault_name,
                vault_path=vault_path,
                enabled=True,
                check_interval=300,  # 5 minutes
                debounce_delay=2.0   # 2 seconds
            )
            
            # Add callback for this vault's changes
            async def handle_vault_changes(events):
                """Handle file change events for this vault."""
                vault_events = [e for e in events if e.vault_name == vault_name]
                if not vault_events:
                    return
                
                # Group events by type
                changes = {
                    'added': [],
                    'modified': [],
                    'deleted': []
                }
                
                for event in vault_events:
                    if event.event_type in ['created']:
                        changes['added'].append(event.file_path)
                    elif event.event_type in ['modified']:
                        changes['modified'].append(event.file_path)
                    elif event.event_type in ['deleted']:
                        changes['deleted'].append(event.file_path)
                    elif event.event_type in ['moved']:
                        # Handle moves as delete old + add new
                        if event.old_path:
                            changes['deleted'].append(event.old_path)
                        changes['added'].append(event.file_path)
                
                # Remove duplicates
                for key in changes:
                    changes[key] = list(set(changes[key]))
                
                # Only process if there are actual changes
                total_changes = sum(len(files) for files in changes.values())
                if total_changes > 0:
                    logger.info(f"Processing {total_changes} file changes for vault '{vault_name}'")
                    try:
                        await self.incremental_update(vault_name, changes)
                    except Exception as e:
                        logger.error(f"Failed to process incremental update for vault '{vault_name}': {e}")
            
            file_change_service.add_change_callback(handle_vault_changes)
            
            logger.info(f"Set up incremental updates for vault '{vault_name}'")
            
        except Exception as e:
            logger.error(f"Failed to setup incremental updates for vault '{vault_name}': {e}")
            raise

    async def get_vault_metadata_stats(self, vault_name: str) -> Dict[str, Any]:
        """Get comprehensive metadata statistics for a vault."""
        try:
            collection = await self.database.get_vault_collection(vault_name)
            
            # Get all documents with metadata
            all_docs = collection.get(include=['metadatas'])
            
            if not all_docs or not all_docs['metadatas']:
                return {
                    'vault_name': vault_name,
                    'total_documents': 0,
                    'metadata_fields': {},
                    'content_types': {},
                    'file_extensions': {},
                    'error': 'No documents found'
                }
            
            metadatas = all_docs['metadatas']
            
            # Analyze metadata
            field_counts = {}
            content_types = {}
            file_extensions = {}
            content_sizes = {'small': 0, 'medium': 0, 'large': 0}
            features = {}
            
            for metadata in metadatas:
                # Count fields
                for field in metadata.keys():
                    field_counts[field] = field_counts.get(field, 0) + 1
                
                # Count content types
                content_type = metadata.get('content_type', 'unknown')
                content_types[content_type] = content_types.get(content_type, 0) + 1
                
                # Count file extensions
                file_ext = metadata.get('file_extension', 'unknown')
                file_extensions[file_ext] = file_extensions.get(file_ext, 0) + 1
                
                # Count content sizes
                content_size = metadata.get('content_size', 'unknown')
                if content_size in content_sizes:
                    content_sizes[content_size] += 1
                
                # Count features
                content_features = metadata.get('content_features', '')
                if content_features:
                    for feature in content_features.split(', '):
                        features[feature] = features.get(feature, 0) + 1
            
            return {
                'vault_name': vault_name,
                'total_documents': len(metadatas),
                'metadata_fields': dict(sorted(field_counts.items(), key=lambda x: x[1], reverse=True)),
                'content_types': dict(sorted(content_types.items(), key=lambda x: x[1], reverse=True)),
                'file_extensions': dict(sorted(file_extensions.items(), key=lambda x: x[1], reverse=True)),
                'content_sizes': content_sizes,
                'content_features': dict(sorted(features.items(), key=lambda x: x[1], reverse=True)),
                'metadata_version': '2.0'
            }
            
        except ValueError as e:
            raise e
        except Exception as e:
            logger.error(f"Failed to get metadata stats for vault '{vault_name}': {e}")
            raise
    
    async def search_vault_by_metadata(
        self, 
        vault_name: str,
        metadata_filters: Dict[str, Any],
        limit: int = 10
    ) -> Dict[str, Any]:
        """
        Search vault using enhanced metadata filtering.
        
        Args:
            vault_name: Target vault name
            metadata_filters: Metadata-based filters
            limit: Maximum results
            
        Returns:
            Search results with metadata focus
        """
        try:
            start_time = time.time()
            
            # Get vault collection
            collection = await self.database.get_vault_collection(vault_name)
            
            # Perform metadata-based search
            results = collection.get(
                where=metadata_filters,
                limit=limit,
                include=['documents', 'metadatas', 'ids']
            )
            
            # Process results
            processed_results = []
            if results and results['documents']:
                for i, (doc, metadata) in enumerate(zip(results['documents'], results['metadatas'])):
                    result = {
                        'id': results['ids'][i],
                        'content': doc,
                        'metadata': metadata,
                        'enhanced_metadata': {
                            'content_type': metadata.get('content_type', 'unknown'),
                            'content_size': metadata.get('content_size', 'unknown'),
                            'content_features': metadata.get('content_features', ''),
                            'metadata_richness': metadata.get('metadata_richness', 0),
                            'content_preview': metadata.get('content_preview', '')
                        }
                    }
                    processed_results.append(result)
            
            search_time_ms = (time.time() - start_time) * 1000
            
            return {
                'results': processed_results,
                'total_found': len(processed_results),
                'search_time_ms': search_time_ms,
                'filters_applied': metadata_filters,
                'vault_name': vault_name
            }
            
        except ValueError as e:
            raise e
        except Exception as e:
            logger.error(f"Metadata search failed for vault '{vault_name}': {e}")
            raise
    
    async def get_vault_content_analysis(self, vault_name: str) -> Dict[str, Any]:
        """Get detailed content analysis for a vault using enhanced metadata."""
        try:
            collection = await self.database.get_vault_collection(vault_name)
            
            # Get all documents with metadata
            all_docs = collection.get(include=['metadatas'])
            
            if not all_docs or not all_docs['metadatas']:
                return {
                    'vault_name': vault_name,
                    'analysis': 'No documents found for analysis'
                }
            
            metadatas = all_docs['metadatas']
            
            # Analyze content patterns
            analysis = {
                'vault_name': vault_name,
                'total_documents': len(metadatas),
                'content_analysis': {},
                'writing_patterns': {},
                'document_purposes': {},
                'complexity_metrics': {}
            }
            
            # Content type distribution
            content_types = {}
            document_purposes = {}
            total_words = 0
            total_chars = 0
            feature_usage = {}
            
            for metadata in metadatas:
                # Content types
                content_type = metadata.get('content_type', 'unknown')
                content_types[content_type] = content_types.get(content_type, 0) + 1
                
                # Document purposes
                purpose = metadata.get('document_purpose', 'unknown')
                document_purposes[purpose] = document_purposes.get(purpose, 0) + 1
                
                # Aggregate metrics
                word_count = metadata.get('word_count', 0)
                char_count = metadata.get('char_count', 0)
                if isinstance(word_count, (int, float)):
                    total_words += word_count
                if isinstance(char_count, (int, float)):
                    total_chars += char_count
                
                # Feature usage
                features = metadata.get('content_features', '')
                if features:
                    for feature in features.split(', '):
                        feature_usage[feature] = feature_usage.get(feature, 0) + 1
            
            analysis['content_analysis'] = {
                'content_types': content_types,
                'total_words': total_words,
                'total_characters': total_chars,
                'avg_words_per_doc': round(total_words / len(metadatas), 2) if metadatas else 0,
                'feature_usage': feature_usage
            }
            
            analysis['document_purposes'] = document_purposes
            analysis['writing_patterns'] = self._analyze_writing_patterns(metadatas)
            analysis['complexity_metrics'] = self._analyze_complexity_metrics(metadatas)
            
            return analysis
            
        except ValueError as e:
            raise e
        except Exception as e:
            logger.error(f"Content analysis failed for vault '{vault_name}': {e}")
            raise
    
    def _analyze_writing_patterns(self, metadatas: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze writing patterns from metadata."""
        patterns = {
            'avg_word_length': 0,
            'structure_usage': {},
            'link_density_avg': 0,
            'document_complexity': {}
        }
        
        total_avg_word_length = 0
        total_link_density = 0
        structure_counts = {}
        complexity_scores = []
        
        valid_docs = 0
        
        for metadata in metadatas:
            # Average word length
            avg_word_length = metadata.get('avg_word_length', 0)
            if isinstance(avg_word_length, (int, float)) and avg_word_length > 0:
                total_avg_word_length += avg_word_length
                valid_docs += 1
            
            # Link density
            link_density = metadata.get('link_density', 0)
            if isinstance(link_density, (int, float)):
                total_link_density += link_density
            
            # Structure elements
            if metadata.get('has_tables'):
                structure_counts['tables'] = structure_counts.get('tables', 0) + 1
            if metadata.get('has_lists'):
                structure_counts['lists'] = structure_counts.get('lists', 0) + 1
            if metadata.get('has_code_patterns'):
                structure_counts['code'] = structure_counts.get('code', 0) + 1
            if metadata.get('has_math_patterns'):
                structure_counts['math'] = structure_counts.get('math', 0) + 1
            
            # Complexity score (based on metadata richness)
            richness = metadata.get('metadata_richness', 0)
            if isinstance(richness, (int, float)):
                complexity_scores.append(richness)
        
        if valid_docs > 0:
            patterns['avg_word_length'] = round(total_avg_word_length / valid_docs, 2)
        
        if metadatas:
            patterns['link_density_avg'] = round(total_link_density / len(metadatas), 3)
        
        patterns['structure_usage'] = structure_counts
        
        if complexity_scores:
            patterns['document_complexity'] = {
                'avg_complexity': round(sum(complexity_scores) / len(complexity_scores), 2),
                'min_complexity': min(complexity_scores),
                'max_complexity': max(complexity_scores)
            }
        
        return patterns
    
    def _analyze_complexity_metrics(self, metadatas: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze document complexity metrics."""
        metrics = {
            'size_distribution': {'small': 0, 'medium': 0, 'large': 0},
            'feature_complexity': {},
            'structural_complexity': {}
        }
        
        # Size distribution
        for metadata in metadatas:
            content_size = metadata.get('content_size', 'unknown')
            if content_size in metrics['size_distribution']:
                metrics['size_distribution'][content_size] += 1
        
        # Feature complexity (documents with multiple features)
        feature_complexity_counts = {}
        for metadata in metadatas:
            features = metadata.get('content_features', '')
            if features:
                feature_count = len(features.split(', '))
                feature_complexity_counts[feature_count] = feature_complexity_counts.get(feature_count, 0) + 1
        
        metrics['feature_complexity'] = feature_complexity_counts
        
        # Structural complexity (based on headings, sections, etc.)
        heading_counts = {}
        for metadata in metadatas:
            # This would need to be enhanced based on actual structure metadata
            # For now, using a simple approximation
            word_count = metadata.get('word_count', 0)
            if isinstance(word_count, (int, float)):
                if word_count > 1000:
                    complexity = 'high'
                elif word_count > 300:
                    complexity = 'medium'
                else:
                    complexity = 'low'
                
                heading_counts[complexity] = heading_counts.get(complexity, 0) + 1
        
        metrics['structural_complexity'] = heading_counts
        
        return metrics

    async def health_check(self) -> Dict[str, Any]:
        """Service health check."""
        try:
            # Test basic functionality
            db_health = await self.database.health_check()
            embed_health = await self.embedding_service.health_check()
            
            return {
                'status': 'healthy',
                'database': db_health,
                'embedding_service': embed_health,
                'active_jobs': len(self.active_jobs),
                'components': {
                    'parser': 'healthy',
                    'chunker': 'healthy', 
                    'file_tracker': 'healthy',
                    'link_graph': 'healthy',
                    'metadata_enhancer': 'healthy'
                }
            }
        except Exception as e:
            return {
                'status': 'unhealthy',
                'error': str(e),
                'active_jobs': len(self.active_jobs)
            }