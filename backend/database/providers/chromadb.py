"""
ChromaDB embedding provider.
Simplified implementation that delegates to ChromaDB's built-in embeddings.
"""
from typing import List, Protocol


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
    """ChromaDB embedding provider - delegates to ChromaDB's internal embeddings."""
    
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model_name = model_name
        self.dimension = 384  # Default ChromaDB dimension
        self.initialized = False
    
    async def initialize(self) -> None:
        """Initialize ChromaDB provider."""
        # ChromaDB handles embeddings internally, no initialization needed
        self.initialized = True
    
    async def encode_texts(self, texts: List[str]) -> List[List[float]]:
        """
        Return placeholder embeddings.
        ChromaDB handles real embeddings when documents are added to collections.
        """
        if not self.initialized:
            await self.initialize()
        
        # Return placeholder embeddings - ChromaDB will handle real ones
        return [[0.0] * self.dimension for _ in texts]
    
    def get_dimension(self) -> int:
        """Get embedding dimension."""
        return self.dimension