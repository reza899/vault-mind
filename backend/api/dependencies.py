"""
FastAPI dependency injection providers.
Provides shared instances for database and services.
"""
from fastapi import HTTPException, status
from database import VaultDatabase, EmbeddingService
from services.vault_service import VaultService

# Global service instances (initialized in app.py lifespan)
vault_db: VaultDatabase = None
embedding_service: EmbeddingService = None


def get_database() -> VaultDatabase:
    """Get the global database instance."""
    if vault_db is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not initialized"
        )
    return vault_db


def get_embedding_service() -> EmbeddingService:
    """Get the global embedding service instance."""
    if embedding_service is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Embedding service not initialized"
        )
    return embedding_service


def get_vault_service() -> VaultService:
    """Get vault service instance with dependencies."""
    database = get_database()
    embedder = get_embedding_service()
    return VaultService(database, embedder)


def set_global_dependencies(db: VaultDatabase, embedder: EmbeddingService):
    """Set global service instances (called from app.py lifespan)."""
    global vault_db, embedding_service
    vault_db = db
    embedding_service = embedder