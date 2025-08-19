"""
FastAPI dependency injection providers.
Provides shared instances for database and services.
"""

from fastapi import HTTPException, status
from database import VaultDatabase, EmbeddingService
from database.providers.chromadb import ChromaDBProvider
from services.vault_service import VaultService
from services.collection_manager import CollectionManager

# Global service instances (initialized in app.py lifespan)
vault_db: VaultDatabase = None
embedding_service: EmbeddingService = None
chroma_provider: ChromaDBProvider = None
collection_manager: CollectionManager = None


def get_database() -> VaultDatabase:
    """Get the global database instance."""
    if vault_db is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not initialized",
        )
    return vault_db


def get_embedding_service() -> EmbeddingService:
    """Get the global embedding service instance."""
    if embedding_service is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Embedding service not initialized",
        )
    return embedding_service


def get_vault_service() -> VaultService:
    """Get vault service instance with dependencies."""
    database = get_database()
    embedder = get_embedding_service()
    return VaultService(database, embedder)


def get_chroma_provider() -> ChromaDBProvider:
    """Get the global ChromaDB provider instance."""
    if chroma_provider is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ChromaDB provider not initialized",
        )
    return chroma_provider


def get_collection_manager() -> CollectionManager:
    """Get the global collection manager instance."""
    if collection_manager is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Collection manager not initialized",
        )
    return collection_manager


def set_global_dependencies(
    db: VaultDatabase,
    embedder: EmbeddingService,
    chroma: ChromaDBProvider = None,
    col_manager: CollectionManager = None,
):
    """Set global service instances (called from app.py lifespan)."""
    global vault_db, embedding_service, chroma_provider, collection_manager
    vault_db = db
    embedding_service = embedder
    chroma_provider = chroma
    collection_manager = col_manager
