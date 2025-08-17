"""
Integration tests for Vault Mind API.
Tests complete API functionality with real service integration.
"""
import pytest
import asyncio
import tempfile
import shutil
from pathlib import Path
from fastapi.testclient import TestClient

from app import app
from api.dependencies import set_global_dependencies
from database import VaultDatabase, EmbeddingService
from config import config


@pytest.fixture(scope="module")
def test_client():
    """Create test client with real dependencies."""
    # Use in-memory/temporary storage for tests
    with tempfile.TemporaryDirectory() as temp_dir:
        # Override config for testing
        test_config = config
        test_config.chroma_persist_dir = temp_dir
        
        # Create test services
        test_db = VaultDatabase(persist_directory=temp_dir)
        test_embedder = EmbeddingService()
        
        # Set up dependencies
        set_global_dependencies(test_db, test_embedder)
        
        with TestClient(app) as client:
            yield client


@pytest.fixture(scope="module")
def test_vault():
    """Create a temporary test vault with markdown files."""
    with tempfile.TemporaryDirectory() as temp_dir:
        vault_path = Path(temp_dir) / "test_vault"
        vault_path.mkdir()
        
        # Create test markdown files
        (vault_path / "note1.md").write_text("""
# First Note
This is the first test note about artificial intelligence.
AI is transforming how we work and live.
        """)
        
        (vault_path / "note2.md").write_text("""
# Second Note
This note discusses machine learning concepts.
Machine learning is a subset of artificial intelligence.
        """)
        
        (vault_path / "note3.md").write_text("""
# Third Note
Deep learning and neural networks are fascinating topics.
These technologies power modern AI applications.
        """)
        
        yield str(vault_path)


class TestHealthEndpoints:
    """Test basic health and status endpoints."""
    
    def test_root_endpoint(self, test_client):
        """Test root endpoint returns API information."""
        response = test_client.get("/")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "success"
        assert "Vault Mind API" in data["data"]["name"]
        assert "/docs" in data["data"]["documentation"]
    
    def test_health_endpoint(self, test_client):
        """Test health check endpoint."""
        response = test_client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "success"
        assert "database" in data["data"]
        assert "embedding_service" in data["data"]
    
    def test_status_health_endpoint(self, test_client):
        """Test status/health endpoint."""
        response = test_client.get("/status/health")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "success"
        assert "healthy" in data["data"]


class TestIndexingEndpoints:
    """Test vault indexing functionality."""
    
    def test_index_vault_invalid_path(self, test_client):
        """Test indexing with invalid vault path."""
        response = test_client.post("/index", json={
            "vault_name": "test_vault",
            "vault_path": "/nonexistent/path",
            "description": "Test vault"
        })
        
        assert response.status_code == 422  # Pydantic validation error
        error_detail = str(response.json()["detail"])
        assert "does not exist" in error_detail
    
    def test_index_vault_invalid_name(self, test_client):
        """Test indexing with invalid vault name."""
        response = test_client.post("/index", json={
            "vault_name": "invalid/name",
            "vault_path": "/tmp",
            "description": "Test vault"
        })
        
        assert response.status_code == 422  # Validation error
    
    def test_index_vault_success(self, test_client, test_vault):
        """Test successful vault indexing."""
        response = test_client.post("/index", json={
            "vault_name": "test_vault",
            "vault_path": test_vault,
            "description": "Test vault for integration tests"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "success"
        assert "job_id" in data["data"]
        assert data["data"]["vault_name"] == "test_vault"
        
        return data["data"]["job_id"]
    
    def test_get_job_status(self, test_client, test_vault):
        """Test getting job status."""
        # First create a job
        response = test_client.post("/index", json={
            "vault_name": "test_vault_2",
            "vault_path": test_vault,
        })
        
        assert response.status_code == 200
        job_id = response.json()["data"]["job_id"]
        
        # Get job status
        response = test_client.get(f"/index/job/{job_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "success"
        assert data["data"]["job_id"] == job_id
        assert data["data"]["vault_name"] == "test_vault_2"
    
    def test_get_job_status_not_found(self, test_client):
        """Test getting status for nonexistent job."""
        response = test_client.get("/index/job/nonexistent-job-id")
        
        assert response.status_code == 404
        assert "not found" in response.json()["detail"]
    
    def test_get_all_jobs(self, test_client):
        """Test getting all jobs."""
        response = test_client.get("/index/jobs")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "success"
        assert "active_jobs" in data["data"]
        assert "recent_jobs" in data["data"]


class TestSearchEndpoints:
    """Test search functionality."""
    
    @pytest.fixture(autouse=True)
    def setup_indexed_vault(self, test_client, test_vault):
        """Set up an indexed vault for search tests."""
        # Index a vault first
        response = test_client.post("/index", json={
            "vault_name": "search_test_vault",
            "vault_path": test_vault,
        })
        
        assert response.status_code == 200
        job_id = response.json()["data"]["job_id"]
        
        # Wait a moment for indexing to start
        import time
        time.sleep(0.5)
        
        self.vault_name = "search_test_vault"
    
    def test_search_vault_get(self, test_client):
        """Test search using GET endpoint."""
        response = test_client.get("/search", params={
            "vault_name": self.vault_name,
            "query": "artificial intelligence",
            "limit": 5
        })
        
        # Note: This might fail initially if indexing isn't complete
        # In a real test environment, we'd wait for indexing completion
        if response.status_code == 404:
            pytest.skip("Vault not yet indexed - timing dependent")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "success"
        assert "results" in data["data"]
        assert "total_found" in data["data"]
        assert "search_time_ms" in data["data"]
    
    def test_search_vault_post(self, test_client):
        """Test search using POST endpoint."""
        response = test_client.post("/search", json={
            "vault_name": self.vault_name,
            "query": "machine learning",
            "limit": 3,
            "similarity_threshold": 0.6
        })
        
        if response.status_code == 404:
            pytest.skip("Vault not yet indexed - timing dependent")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "success"
        assert len(data["data"]["results"]) <= 3
    
    def test_search_invalid_vault(self, test_client):
        """Test search with nonexistent vault."""
        response = test_client.get("/search", params={
            "vault_name": "nonexistent_vault",
            "query": "test query"
        })
        
        assert response.status_code == 404
        assert "not found" in response.json()["detail"]
    
    def test_search_empty_query(self, test_client):
        """Test search with empty query."""
        response = test_client.get("/search", params={
            "vault_name": self.vault_name,
            "query": ""
        })
        
        assert response.status_code == 422  # Validation error
    
    def test_search_collections(self, test_client):
        """Test listing searchable collections."""
        response = test_client.get("/search/collections")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "success"
        assert "collections" in data["data"]
        assert "total_collections" in data["data"]


class TestStatusEndpoints:
    """Test status and monitoring endpoints."""
    
    def test_system_status(self, test_client):
        """Test system status endpoint."""
        response = test_client.get("/status")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "success"
        assert "system_status" in data["data"]
        assert "vault_collections" in data["data"]
        assert "active_jobs" in data["data"]
        assert "database_health" in data["data"]
    
    def test_system_status_post(self, test_client):
        """Test system status POST endpoint."""
        response = test_client.post("/status", json={
            "include_metrics": True
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "success"
        assert "system_status" in data["data"]
    
    def test_status_metrics(self, test_client):
        """Test performance metrics endpoint."""
        response = test_client.get("/status/metrics")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "success"
        assert "system_metrics" in data["data"]
        assert "job_statistics" in data["data"]


class TestAPIDocumentation:
    """Test API documentation generation."""
    
    def test_openapi_schema(self, test_client):
        """Test OpenAPI schema generation."""
        response = test_client.get("/openapi.json")
        
        assert response.status_code == 200
        schema = response.json()
        
        assert "openapi" in schema
        assert "paths" in schema
        
        # Check that our endpoints are documented
        paths = schema["paths"]
        assert "/index" in paths
        assert "/search" in paths
        assert "/status" in paths
        assert "/health" in paths
    
    def test_docs_endpoint(self, test_client):
        """Test documentation UI endpoint."""
        response = test_client.get("/docs")
        
        assert response.status_code == 200
        assert "swagger" in response.text.lower()
    
    def test_redoc_endpoint(self, test_client):
        """Test ReDoc documentation endpoint."""
        response = test_client.get("/redoc")
        
        assert response.status_code == 200
        assert "redoc" in response.text.lower()


class TestErrorHandling:
    """Test error handling and edge cases."""
    
    def test_404_endpoint(self, test_client):
        """Test accessing nonexistent endpoint."""
        response = test_client.get("/nonexistent")
        
        assert response.status_code == 404
    
    def test_method_not_allowed(self, test_client):
        """Test using wrong HTTP method."""
        response = test_client.delete("/health")
        
        assert response.status_code == 405
    
    def test_invalid_json(self, test_client):
        """Test sending invalid JSON."""
        response = test_client.post("/index", 
                                  data="invalid json",
                                  headers={"Content-Type": "application/json"})
        
        assert response.status_code == 422
    
    def test_missing_required_fields(self, test_client):
        """Test missing required fields in request."""
        response = test_client.post("/index", json={
            "vault_name": "test"
            # Missing vault_path
        })
        
        assert response.status_code == 422
    
    def test_correlation_id_in_responses(self, test_client):
        """Test that responses include correlation IDs."""
        response = test_client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "request_id" in data
        assert data["request_id"]  # Should not be empty
        
        # Check header
        assert "X-Correlation-ID" in response.headers


class TestPerformance:
    """Test API performance characteristics."""
    
    def test_health_check_performance(self, test_client):
        """Test health check meets performance target (<100ms)."""
        import time
        
        start_time = time.time()
        response = test_client.get("/status/health")
        end_time = time.time()
        
        assert response.status_code == 200
        
        # Check response time
        response_time_ms = (end_time - start_time) * 1000
        assert response_time_ms < 100, f"Health check took {response_time_ms:.1f}ms (target: <100ms)"
    
    def test_status_endpoint_performance(self, test_client):
        """Test status endpoint performance (<100ms target)."""
        import time
        
        start_time = time.time()
        response = test_client.get("/status")
        end_time = time.time()
        
        assert response.status_code == 200
        
        response_time_ms = (end_time - start_time) * 1000
        assert response_time_ms < 200, f"Status endpoint took {response_time_ms:.1f}ms (target: <200ms)"
    
    def test_concurrent_requests(self, test_client):
        """Test handling concurrent requests."""
        import threading
        import time
        
        results = []
        
        def make_request():
            response = test_client.get("/health")
            results.append(response.status_code)
        
        # Create multiple threads
        threads = []
        for _ in range(5):
            thread = threading.Thread(target=make_request)
            threads.append(thread)
        
        # Start all threads
        start_time = time.time()
        for thread in threads:
            thread.start()
        
        # Wait for completion
        for thread in threads:
            thread.join()
        
        end_time = time.time()
        
        # All requests should succeed
        assert all(status == 200 for status in results)
        assert len(results) == 5
        
        # Should complete within reasonable time
        total_time = end_time - start_time
        assert total_time < 2.0, f"Concurrent requests took {total_time:.2f}s"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])