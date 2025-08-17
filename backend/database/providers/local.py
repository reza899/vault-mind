"""
Local embedding provider using sentence-transformers.
Simplified implementation for local model execution.
"""
import logging
from typing import List

logger = logging.getLogger(__name__)


class LocalProvider:
    """Local sentence-transformer embedding provider."""
    
    def __init__(self, model_name: str = "all-MiniLM-L6-v2", device: str = "cpu"):
        self.model_name = model_name
        self.device = device
        self.model = None
        self.initialized = False
    
    async def initialize(self) -> None:
        """Initialize local model."""
        try:
            from sentence_transformers import SentenceTransformer
            
            self.model = SentenceTransformer(self.model_name, device=self.device)
            self.initialized = True
            logger.info(f"Local model {self.model_name} initialized on {self.device}")
            
        except ImportError:
            raise ImportError(
                "sentence-transformers package required. Install with: pip install sentence-transformers"
            )
    
    async def encode_texts(self, texts: List[str]) -> List[List[float]]:
        """Encode texts using local model."""
        if not self.initialized:
            await self.initialize()
        
        embeddings = self.model.encode(texts, convert_to_tensor=False, normalize_embeddings=True)
        
        # Ensure list format
        if hasattr(embeddings, 'tolist'):
            return embeddings.tolist()
        return embeddings
    
    def get_dimension(self) -> int:
        """Get embedding dimension."""
        if not self.initialized or not self.model:
            # Common dimensions for fallback
            if "MiniLM" in self.model_name:
                return 384
            elif "base" in self.model_name:
                return 768
            return 384
        
        try:
            if hasattr(self.model, 'get_sentence_embedding_dimension'):
                return self.model.get_sentence_embedding_dimension()
            
            # Fallback: test encode
            test_embedding = self.model.encode(["test"], convert_to_tensor=False)
            return len(test_embedding[0]) if hasattr(test_embedding, '__len__') else 384
            
        except Exception:
            return 384