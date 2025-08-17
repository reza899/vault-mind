"""
Simplified database package.
Exports the main classes for embedding and vault management.
"""
from .vault_database import VaultDatabase
from .embedding_service import EmbeddingService

__all__ = ['VaultDatabase', 'EmbeddingService']