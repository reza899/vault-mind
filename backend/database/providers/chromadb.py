"""
ChromaDB embedding provider with multi-collection support.
Handles ChromaDB client operations and collection management.
"""
import logging
from pathlib import Path
from typing import List, Protocol, Dict, Any, Optional
import chromadb
from chromadb.config import Settings

from config.config import config

logger = logging.getLogger(__name__)


class EmbeddingProvider(Protocol):
    """Protocol for embedding providers."""
    
    async def initialize(self) -> None:
        """Initialize the provider."""
        ...
    
    async def encode_texts(self, texts: List[str]) -> List[List[float]]:
        """Encode texts to embeddings."""
        ...
    
    def get_dimension(self) -> int:
        """Get embedding dimension."""
        ...


class ChromaDBProvider:
    """
    ChromaDB provider with multi-collection support.
    
    Handles ChromaDB client operations, collection management, and embeddings.
    Provides collection-level operations required for VMIND-031 API.
    """
    
    def __init__(self, model_name: str = "all-MiniLM-L6-v2", shared_client=None):
        self.model_name = model_name
        # Set dimension based on model
        if "mpnet" in model_name.lower():
            self.dimension = 768  # all-mpnet-base-v2
        else:
            self.dimension = 384  # all-MiniLM-L6-v2
        self.initialized = False
        self.client = shared_client  # Use shared client if provided
        self.settings = config
    
    async def initialize(self) -> None:
        """Initialize ChromaDB client and connection."""
        if self.initialized:
            return
        
        try:
            # If no shared client provided, create our own
            if self.client is None:
                # Create persistent directory
                persist_path = Path(self.settings.chroma_persist_dir)
                persist_path.mkdir(parents=True, exist_ok=True)
                
                # Initialize ChromaDB client
                self.client = chromadb.PersistentClient(
                    path=str(persist_path),
                    settings=Settings(
                        anonymized_telemetry=False,
                        allow_reset=True,
                        is_persistent=True
                    )
                )
            
            self.initialized = True
            logger.info(f"ChromaDB client initialized (shared: {self.client is not None})")
            
        except Exception as e:
            logger.error(f"Failed to initialize ChromaDB client: {str(e)}", exc_info=True)
            raise
    
    async def encode_texts(self, texts: List[str]) -> List[List[float]]:
        """
        Generate real embeddings using sentence-transformers.
        """
        if not self.initialized:
            await self.initialize()
        
        try:
            from sentence_transformers import SentenceTransformer
            
            # Initialize model
            if not hasattr(self, '_model'):
                self._model = SentenceTransformer(self.model_name)
            
            # Generate embeddings
            embeddings = self._model.encode(texts)
            return embeddings.tolist()
            
        except Exception as e:
            logger.error(f"Failed to generate embeddings: {e}", exc_info=True)
            # Fallback to zeros if embedding fails
            return [[0.0] * self.dimension for _ in texts]
    
    def get_dimension(self) -> int:
        """Get embedding dimension."""
        return self.dimension

    # Multi-collection management methods for VMIND-031

    async def list_collections(self) -> List[Dict[str, Any]]:
        """
        List all ChromaDB collections with metadata.
        
        Returns:
            List of collection information
        """
        if not self.initialized:
            await self.initialize()
        
        try:
            collections = self.client.list_collections()
            
            collection_info = []
            for collection in collections:
                info = {
                    "name": collection.name,
                    "id": collection.id,
                    "metadata": collection.metadata or {},
                    "count": collection.count(),
                    "embedding_function": getattr(collection._embedding_function, 'model_name', self.model_name)
                }
                collection_info.append(info)
            
            return collection_info
            
        except Exception as e:
            logger.error(f"Error listing ChromaDB collections: {str(e)}", exc_info=True)
            raise

    async def collection_exists(self, collection_name: str) -> bool:
        """
        Check if a collection exists in ChromaDB.
        
        Args:
            collection_name: Name of collection to check
            
        Returns:
            True if collection exists
        """
        if not self.initialized:
            await self.initialize()
        
        try:
            collections = self.client.list_collections()
            return any(col.name == collection_name for col in collections)
            
        except Exception as e:
            logger.error(f"Error checking collection existence: {str(e)}", exc_info=True)
            return False

    async def create_collection(
        self,
        collection_name: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Create a new ChromaDB collection.
        
        Args:
            collection_name: Name of the collection
            metadata: Optional collection metadata
            
        Returns:
            Collection information
        """
        if not self.initialized:
            await self.initialize()
        
        try:
            # Check if collection already exists
            if await self.collection_exists(collection_name):
                raise ValueError(f"Collection '{collection_name}' already exists")
            
            # Create collection with default embedding function
            # ChromaDB requires non-empty metadata, provide default
            collection_metadata = metadata or {"created_by": "vault_mind"}
            collection = self.client.create_collection(
                name=collection_name,
                metadata=collection_metadata,
                embedding_function=None  # Use ChromaDB default
            )
            
            logger.info(f"ChromaDB collection created: {collection_name}")
            
            return {
                "name": collection.name,
                "id": collection.id,
                "metadata": collection.metadata,
                "count": 0,
                "created": True
            }
            
        except Exception as e:
            logger.error(f"Error creating ChromaDB collection {collection_name}: {str(e)}", exc_info=True)
            raise

    async def delete_collection(self, collection_name: str) -> bool:
        """
        Delete a ChromaDB collection.
        
        Args:
            collection_name: Name of collection to delete
            
        Returns:
            True if deleted successfully
        """
        if not self.initialized:
            await self.initialize()
        
        try:
            if not await self.collection_exists(collection_name):
                logger.warning(f"Collection '{collection_name}' does not exist for deletion")
                return False
            
            self.client.delete_collection(name=collection_name)
            logger.info(f"ChromaDB collection deleted: {collection_name}")
            return True
            
        except Exception as e:
            logger.error(f"Error deleting ChromaDB collection {collection_name}: {str(e)}", exc_info=True)
            raise

    async def get_collection_stats(self, collection_name: str) -> Optional[Dict[str, Any]]:
        """
        Get statistics for a ChromaDB collection.
        
        Args:
            collection_name: Name of collection
            
        Returns:
            Collection statistics or None if not found
        """
        if not self.initialized:
            await self.initialize()
        
        try:
            if not await self.collection_exists(collection_name):
                return None
            
            collection = self.client.get_collection(name=collection_name)
            
            stats = {
                "name": collection.name,
                "id": collection.id,
                "count": collection.count(),
                "metadata": collection.metadata or {},
                "embedding_function": getattr(collection._embedding_function, 'model_name', self.model_name)
            }
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting collection stats for {collection_name}: {str(e)}", exc_info=True)
            return None

    async def add_documents(
        self,
        collection_name: str,
        documents: List[str],
        ids: List[str],
        metadatas: Optional[List[Dict[str, Any]]] = None
    ) -> bool:
        """
        Add documents to a ChromaDB collection.
        
        Args:
            collection_name: Target collection
            documents: List of document texts
            ids: List of document IDs
            metadatas: Optional list of metadata dicts
            
        Returns:
            True if successful
        """
        if not self.initialized:
            await self.initialize()
        
        try:
            if not await self.collection_exists(collection_name):
                raise ValueError(f"Collection '{collection_name}' does not exist")
            
            collection = self.client.get_collection(name=collection_name)
            
            collection.add(
                documents=documents,
                ids=ids,
                metadatas=metadatas
            )
            
            logger.info(f"Added {len(documents)} documents to collection: {collection_name}")
            return True
            
        except Exception as e:
            logger.error(f"Error adding documents to {collection_name}: {str(e)}", exc_info=True)
            raise

    async def query_collection(
        self,
        collection_name: str,
        query_texts: List[str],
        n_results: int = 10,
        where: Optional[Dict] = None,
        include: List[str] = ["documents", "metadatas", "distances"]
    ) -> Dict[str, Any]:
        """
        Query a ChromaDB collection with semantic search.
        
        Args:
            collection_name: Target collection
            query_texts: List of query strings
            n_results: Number of results per query
            where: Optional metadata filters
            include: What to include in results
            
        Returns:
            Query results
        """
        if not self.initialized:
            await self.initialize()
        
        try:
            if not await self.collection_exists(collection_name):
                raise ValueError(f"Collection '{collection_name}' does not exist")
            
            collection = self.client.get_collection(name=collection_name)
            
            results = collection.query(
                query_texts=query_texts,
                n_results=n_results,
                where=where,
                include=include
            )
            
            return results
            
        except Exception as e:
            logger.error(f"Error querying collection {collection_name}: {str(e)}", exc_info=True)
            raise

    async def get_collection_health(self, collection_name: str) -> Dict[str, Any]:
        """
        Check health status of a ChromaDB collection.
        
        Args:
            collection_name: Collection to check
            
        Returns:
            Health status information
        """
        if not self.initialized:
            await self.initialize()
        
        health_status = {
            "collection_name": collection_name,
            "exists": False,
            "accessible": False,
            "document_count": 0,
            "errors": [],
            "status": "unknown"
        }
        
        try:
            # Check if collection exists
            exists = await self.collection_exists(collection_name)
            health_status["exists"] = exists
            
            if not exists:
                health_status["status"] = "not_found"
                health_status["errors"].append("Collection does not exist")
                return health_status
            
            # Try to access collection
            collection = self.client.get_collection(name=collection_name)
            health_status["accessible"] = True
            
            # Get document count
            count = collection.count()
            health_status["document_count"] = count
            
            # Determine overall status
            if count == 0:
                health_status["status"] = "empty"
            else:
                health_status["status"] = "healthy"
            
        except Exception as e:
            health_status["status"] = "error"
            health_status["errors"].append(str(e))
            logger.error(f"Health check failed for {collection_name}: {str(e)}")
        
        return health_status

    async def cleanup_and_reset(self) -> bool:
        """
        Emergency cleanup - reset ChromaDB client.
        Use with caution as this affects all collections.
        
        Returns:
            True if successful
        """
        try:
            if self.client and self.initialized:
                # This will clear all data - use only for testing/emergency
                self.client.reset()
                logger.warning("ChromaDB client reset - all data cleared")
                
                # Reinitialize
                self.initialized = False
                await self.initialize()
                
            return True
            
        except Exception as e:
            logger.error(f"Error during ChromaDB cleanup: {str(e)}", exc_info=True)
            return False