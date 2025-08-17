"""
Tests for the simplified EmbeddingService.
Tests the new architecture with reduced complexity.
"""
import pytest
from unittest.mock import patch

from config import config, EmbeddingProvider
from database import EmbeddingService


class TestSimplifiedEmbeddingService:
    """Test the simplified embedding service."""
    
    @pytest.mark.asyncio
    async def test_service_creation_with_provider(self):
        """Test service creation with explicit provider."""
        service = EmbeddingService(EmbeddingProvider.CHROMADB)
        await service.initialize()
        
        assert service.provider_type == EmbeddingProvider.CHROMADB
        await service.cleanup()
    
    @pytest.mark.asyncio
    async def test_service_creation_from_config(self):
        """Test service creation using default config."""
        service = EmbeddingService()
        await service.initialize()
        
        assert service.provider_type == config.embedding_provider
        await service.cleanup()
    
    @pytest.mark.asyncio
    async def test_encode_single_text(self):
        """Test encoding a single text."""
        service = EmbeddingService(EmbeddingProvider.CHROMADB)
        await service.initialize()
        
        try:
            embedding = await service.encode_text("Hello world")
            
            assert isinstance(embedding, list)
            assert len(embedding) == 384  # ChromaDB default dimension
            assert all(isinstance(x, float) for x in embedding)
        finally:
            await service.cleanup()
    
    @pytest.mark.asyncio
    async def test_encode_multiple_texts(self):
        """Test encoding multiple texts."""
        service = EmbeddingService(EmbeddingProvider.CHROMADB)
        await service.initialize()
        
        try:
            texts = ["Hello", "World", "Test"]
            embeddings = await service.encode_texts(texts)
            
            assert isinstance(embeddings, list)
            assert len(embeddings) == 3
            assert all(len(emb) == 384 for emb in embeddings)
        finally:
            await service.cleanup()
    
    @pytest.mark.asyncio
    async def test_batch_processing(self):
        """Test batch processing with large text list."""
        service = EmbeddingService(EmbeddingProvider.CHROMADB)
        await service.initialize()
        
        try:
            # Create enough texts to trigger batching
            texts = [f"Text {i}" for i in range(150)]
            
            embeddings = await service.encode_texts(texts)
            
            assert len(embeddings) == 150
            assert all(len(emb) == 384 for emb in embeddings)
        finally:
            await service.cleanup()
    
    @pytest.mark.asyncio
    async def test_caching(self):
        """Test caching functionality."""
        service = EmbeddingService(EmbeddingProvider.CHROMADB)
        await service.initialize()
        
        try:
            texts = ["Cache test"]
            
            # First call
            embeddings1 = await service.encode_texts(texts, use_cache=True)
            
            # Second call should use cache
            embeddings2 = await service.encode_texts(texts, use_cache=True)
            
            assert embeddings1 == embeddings2
        finally:
            await service.cleanup()
    
    @pytest.mark.asyncio
    async def test_input_validation(self):
        """Test input validation."""
        service = EmbeddingService(EmbeddingProvider.CHROMADB)
        await service.initialize()
        
        try:
            # Test non-list input
            with pytest.raises(ValueError, match="Texts must be a list"):
                await service.encode_texts("not a list")
            
            # Test non-string in list
            with pytest.raises(ValueError, match="must be a string"):
                await service.encode_texts(["valid", 123])
            
            # Test empty string
            with pytest.raises(ValueError, match="cannot be empty"):
                await service.encode_texts([""])
        finally:
            await service.cleanup()
    
    @pytest.mark.asyncio
    async def test_health_check(self):
        """Test health check functionality."""
        service = EmbeddingService(EmbeddingProvider.CHROMADB)
        await service.initialize()
        
        try:
            health = await service.health_check()
            
            assert health['status'] == 'healthy'
            assert health['provider_type'] == 'chromadb'
            assert health['embedding_dimension'] == 384
            assert 'metrics' in health
        finally:
            await service.cleanup()
    
    @pytest.mark.asyncio
    async def test_metrics_tracking(self):
        """Test metrics tracking."""
        service = EmbeddingService(EmbeddingProvider.CHROMADB)
        await service.initialize()
        
        try:
            # Initial metrics
            initial_metrics = service.get_metrics()
            assert initial_metrics['total_requests'] == 0
            
            # Encode some texts
            await service.encode_texts(["Test 1", "Test 2"])
            
            # Check updated metrics
            metrics = service.get_metrics()
            assert metrics['total_requests'] == 1
            assert metrics['total_texts_processed'] == 2
            assert metrics['failed_requests'] == 0
        finally:
            await service.cleanup()
    
    @pytest.mark.asyncio
    async def test_openai_fallback(self):
        """Test OpenAI provider fallback to ChromaDB when no API key."""
        service = EmbeddingService(EmbeddingProvider.OPENAI)
        await service.initialize()
        
        # Should fallback to ChromaDB due to missing API key
        from database.providers.chromadb import ChromaDBProvider
        assert isinstance(service.provider, ChromaDBProvider)
        
        await service.cleanup()
    
    @pytest.mark.asyncio
    async def test_cache_clear(self):
        """Test cache clearing functionality."""
        service = EmbeddingService(EmbeddingProvider.CHROMADB)
        await service.initialize()
        
        try:
            # Add something to cache
            await service.encode_texts(["Cache test"], use_cache=True)
            
            # Clear cache
            service.clear_cache()
            
            # Verify cache is empty in health check
            health = await service.health_check()
            assert health['cache_size'] == 0
        finally:
            await service.cleanup()
    
    @pytest.mark.asyncio
    async def test_dimension_retrieval(self):
        """Test getting embedding dimension."""
        service = EmbeddingService(EmbeddingProvider.CHROMADB)
        await service.initialize()
        
        try:
            dimension = service.get_embedding_dimension()
            assert dimension == 384  # ChromaDB default
        finally:
            await service.cleanup()


class TestProviderSelection:
    """Test provider selection logic."""
    
    @pytest.mark.asyncio
    async def test_chromadb_provider_selection(self):
        """Test ChromaDB provider selection."""
        service = EmbeddingService(EmbeddingProvider.CHROMADB)
        await service.initialize()
        
        from database.providers.chromadb import ChromaDBProvider
        assert isinstance(service.provider, ChromaDBProvider)
        
        await service.cleanup()
    
    @pytest.mark.asyncio
    async def test_openai_provider_selection_with_key(self):
        """Test OpenAI provider selection with API key."""
        # Mock the config to have an OpenAI API key
        with patch('config.config.openai_api_key', 'sk-test-key'):
            service = EmbeddingService(EmbeddingProvider.OPENAI)
            
            # Should have OpenAI provider now
            from database.providers.openai import OpenAIProvider
            assert isinstance(service.provider, OpenAIProvider)
            
            await service.initialize()
            await service.cleanup()
    
    @pytest.mark.asyncio
    async def test_local_provider_fallback(self):
        """Test local provider fallback when sentence-transformers not available."""
        service = EmbeddingService(EmbeddingProvider.LOCAL)
        
        # Provider creation should fallback to ChromaDB if sentence-transformers not available
        # The actual provider type depends on whether sentence-transformers is installed
        assert service.provider is not None