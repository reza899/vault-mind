"""
Simplified Embedding Service with strategy pattern.
Replaces the complex factory pattern with direct provider selection.
"""
import logging
import time
from typing import List, Optional, Callable, Dict, Any

from config import config, EmbeddingProvider
from .providers import ChromaDBProvider, OpenAIProvider, LocalProvider

logger = logging.getLogger(__name__)


class EmbeddingService:
    """
    Simplified embedding service using strategy pattern.
    Reduces complexity while maintaining all functionality.
    """
    
    def __init__(self, provider_type: Optional[EmbeddingProvider] = None):
        """
        Initialize embedding service.
        
        Args:
            provider_type: Embedding provider type (uses config default if None)
        """
        self.provider_type = provider_type or config.embedding_provider
        self.provider = self._create_provider()
        self._metrics = {
            'total_requests': 0,
            'total_texts_processed': 0,
            'total_processing_time': 0.0,
            'failed_requests': 0,
            'average_processing_time': 0.0
        }
        self._cache = {} if config.cache_enabled else None
    
    def _create_provider(self):
        """Create provider based on configuration using strategy pattern."""
        if self.provider_type == EmbeddingProvider.CHROMADB:
            return ChromaDBProvider(model_name=config.embedding_model)
        
        elif self.provider_type == EmbeddingProvider.OPENAI:
            if not config.openai_api_key:
                logger.warning("OpenAI API key not found, falling back to ChromaDB")
                return ChromaDBProvider(model_name=config.embedding_model)
            
            return OpenAIProvider(
                model_name=config.embedding_model,
                api_key=config.openai_api_key
            )
        
        elif self.provider_type == EmbeddingProvider.LOCAL:
            try:
                return LocalProvider(model_name=config.embedding_model)
            except ImportError as e:
                logger.warning(f"Local provider not available: {e}, falling back to ChromaDB")
                return ChromaDBProvider(model_name=config.embedding_model)
        
        else:
            raise ValueError(f"Unknown provider type: {self.provider_type}")
    
    async def initialize(self) -> None:
        """Initialize the embedding service."""
        await self.provider.initialize()
        logger.info(f"Embedding service initialized with {self.provider_type.value} provider")
    
    async def encode_texts(
        self,
        texts: List[str],
        use_cache: bool = True,
        progress_callback: Optional[Callable[[int, int], None]] = None,
        **kwargs
    ) -> List[List[float]]:
        """
        Encode multiple texts into embeddings.
        
        Args:
            texts: List of texts to encode
            use_cache: Whether to use caching (if enabled)
            progress_callback: Progress callback function
            **kwargs: Additional encoding parameters
            
        Returns:
            List of embedding vectors
        """
        start_time = time.time()
        
        try:
            # Validate inputs
            self._validate_texts(texts)
            
            # Check cache if enabled
            if self._cache and use_cache:
                cache_key = self._generate_cache_key(texts, **kwargs)
                if cache_key in self._cache:
                    logger.debug(f"Cache hit for {len(texts)} texts")
                    return self._cache[cache_key]
            
            # Process in batches if needed
            if len(texts) > config.batch_size:
                embeddings = await self._encode_in_batches(texts, progress_callback, **kwargs)
            else:
                embeddings = await self.provider.encode_texts(texts)
                if progress_callback:
                    progress_callback(1, 1)
            
            # Cache results if enabled
            if self._cache and use_cache:
                cache_key = self._generate_cache_key(texts, **kwargs)
                self._cache[cache_key] = embeddings
            
            # Update metrics
            processing_time = time.time() - start_time
            self._update_metrics(len(texts), processing_time, success=True)
            
            logger.debug(f"Successfully encoded {len(texts)} texts in {processing_time:.2f}s")
            return embeddings
            
        except Exception as e:
            processing_time = time.time() - start_time
            self._update_metrics(len(texts), processing_time, success=False)
            
            logger.error(f"Failed to encode texts: {e}")
            raise
    
    async def encode_text(self, text: str, use_cache: bool = True, **kwargs) -> List[float]:
        """
        Encode a single text into an embedding.
        
        Args:
            text: Text to encode
            use_cache: Whether to use caching
            **kwargs: Additional encoding parameters
            
        Returns:
            Embedding vector
        """
        embeddings = await self.encode_texts([text], use_cache=use_cache, **kwargs)
        return embeddings[0] if embeddings else []
    
    async def _encode_in_batches(
        self, 
        texts: List[str], 
        progress_callback: Optional[Callable[[int, int], None]] = None,
        **kwargs
    ) -> List[List[float]]:
        """Encode texts in batches."""
        all_embeddings = []
        batch_size = config.batch_size
        total_batches = (len(texts) + batch_size - 1) // batch_size
        
        for i in range(0, len(texts), batch_size):
            batch_texts = texts[i:i + batch_size]
            batch_embeddings = await self.provider.encode_texts(batch_texts)
            all_embeddings.extend(batch_embeddings)
            
            if progress_callback:
                current_batch = (i // batch_size) + 1
                progress_callback(current_batch, total_batches)
        
        return all_embeddings
    
    def _validate_texts(self, texts: List[str]) -> None:
        """Validate input texts."""
        if not isinstance(texts, list):
            raise ValueError("Texts must be a list")
        
        if not texts:
            return  # Empty list is valid
        
        for i, text in enumerate(texts):
            if not isinstance(text, str):
                raise ValueError(f"Text at index {i} must be a string, got {type(text)}")
            
            if not text.strip():
                raise ValueError(f"Text at index {i} cannot be empty or whitespace-only")
            
            # Check for extremely long texts
            if len(text) > 100000:  # 100k character limit
                logger.warning(f"Text at index {i} is very long ({len(text)} chars), consider chunking")
    
    def _generate_cache_key(self, texts: List[str], **kwargs) -> str:
        """Generate a cache key for the given inputs."""
        import hashlib
        
        cache_data = {
            'texts': texts,
            'provider_type': self.provider_type.value,
            'model_name': config.embedding_model,
            **kwargs
        }
        
        cache_str = str(sorted(cache_data.items()))
        return hashlib.md5(cache_str.encode()).hexdigest()
    
    def _update_metrics(self, text_count: int, processing_time: float, success: bool) -> None:
        """Update performance metrics."""
        self._metrics['total_requests'] += 1
        self._metrics['total_texts_processed'] += text_count
        self._metrics['total_processing_time'] += processing_time
        
        if not success:
            self._metrics['failed_requests'] += 1
        
        # Update average processing time
        if self._metrics['total_requests'] > 0:
            self._metrics['average_processing_time'] = (
                self._metrics['total_processing_time'] / self._metrics['total_requests']
            )
    
    def get_embedding_dimension(self) -> int:
        """Get embedding dimension from provider."""
        return self.provider.get_dimension()
    
    def clear_cache(self) -> None:
        """Clear the embedding cache."""
        if self._cache:
            self._cache.clear()
            logger.info("Embedding cache cleared")
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get performance metrics."""
        return self._metrics.copy()
    
    async def health_check(self) -> Dict[str, Any]:
        """
        Perform health check on the embedding service.
        
        Returns:
            Health status information
        """
        try:
            # Test encoding
            test_embedding = await self.encode_text("health check test", use_cache=False)
            
            return {
                'status': 'healthy',
                'provider_type': self.provider_type.value,
                'model_name': config.embedding_model,
                'embedding_dimension': len(test_embedding),
                'cache_enabled': self._cache is not None,
                'cache_size': len(self._cache) if self._cache else 0,
                'metrics': self._metrics.copy()
            }
            
        except Exception as e:
            return {
                'status': 'unhealthy',
                'error': str(e),
                'provider_type': self.provider_type.value,
                'metrics': self._metrics.copy()
            }
    
    async def cleanup(self) -> None:
        """Clean up service resources."""
        if self._cache:
            self._cache.clear()
        
        # Clean up provider if it has cleanup method
        if hasattr(self.provider, 'cleanup'):
            await self.provider.cleanup()
        
        logger.info("Embedding service cleaned up")