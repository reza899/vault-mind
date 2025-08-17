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
                        # Prepare document metadata
                        doc_metadata = {
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
        include_context: bool = True
    ) -> Dict[str, Any]:
        """
        Search vault with semantic similarity.
        
        Args:
            vault_name: Target vault name
            query: Search query
            limit: Maximum results
            similarity_threshold: Minimum similarity score
            include_context: Include surrounding context
            
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
            except:
                pass
            
            # Get next chunk  
            next_id = f"{metadata.get('vault_name')}_{Path(file_path).stem}_{chunk_index + 1}"
            try:
                next_result = collection.get(ids=[next_id], include=['documents'])
                if next_result['documents']:
                    context['after'] = "..." + next_result['documents'][0][-200:]
            except:
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
                    'file_tracker': 'healthy'
                }
            }
        except Exception as e:
            return {
                'status': 'unhealthy',
                'error': str(e),
                'active_jobs': len(self.active_jobs)
            }