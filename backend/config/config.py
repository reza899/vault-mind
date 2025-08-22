"""
Simplified configuration management for the embedding system.
Uses dataclass with environment variable defaults.
"""
import os
from dataclasses import dataclass
from enum import Enum
from typing import Optional


class EmbeddingProvider(Enum):
    """Supported embedding providers."""
    CHROMADB = "chromadb"
    OPENAI = "openai"
    LOCAL = "local"


@dataclass
class Config:
    """Unified configuration with environment defaults."""
    # Embedding settings
    embedding_provider: EmbeddingProvider = EmbeddingProvider.CHROMADB
    embedding_model: str = "all-mpnet-base-v2"
    batch_size: int = 100
    
    # API settings
    openai_api_key: Optional[str] = None
    
    # Database settings
    chroma_persist_dir: str = "./chroma_db"
    
    # Performance settings
    cache_enabled: bool = True
    
    # Development settings
    dev_mode: bool = True
    
    # FastAPI settings
    host: str = "0.0.0.0"
    port: int = 8000
    environment: str = "development"
    log_level: str = "INFO"
    
    # CORS settings
    cors_origins: Optional[str] = None
    
    def __post_init__(self):
        """Load from environment variables."""
        # Embedding settings
        self.embedding_provider = EmbeddingProvider(
            os.getenv('EMBEDDING_PROVIDER', self.embedding_provider.value)
        )
        self.embedding_model = os.getenv('EMBEDDING_MODEL', self.embedding_model)
        self.batch_size = int(os.getenv('EMBEDDING_BATCH_SIZE', str(self.batch_size)))
        self.openai_api_key = os.getenv('OPENAI_API_KEY', self.openai_api_key)
        self.chroma_persist_dir = os.getenv('CHROMA_PERSIST_DIR', self.chroma_persist_dir)
        self.cache_enabled = os.getenv('CACHE_ENABLED', 'true').lower() == 'true'
        self.dev_mode = os.getenv('DEV_MODE', 'true').lower() == 'true'
        
        # FastAPI settings
        self.host = os.getenv('HOST', self.host)
        self.port = int(os.getenv('PORT', str(self.port)))
        self.environment = os.getenv('ENVIRONMENT', self.environment)
        self.log_level = os.getenv('LOG_LEVEL', self.log_level)
        
        # CORS settings
        self.cors_origins = os.getenv('CORS_ORIGINS', self.cors_origins)


# Global config instance
config = Config()