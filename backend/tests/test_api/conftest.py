"""
Pytest configuration for API tests.
Sets up test environment and fixtures.
"""
import pytest
import asyncio
import tempfile


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session") 
def temp_test_dir():
    """Create temporary directory for test data."""
    with tempfile.TemporaryDirectory() as temp_dir:
        yield temp_dir


def pytest_configure(config):
    """Configure pytest for API testing."""
    # Set test markers
    config.addinivalue_line(
        "markers", "integration: marks tests as integration tests"
    )
    config.addinivalue_line(
        "markers", "performance: marks tests as performance tests"  
    )
    config.addinivalue_line(
        "markers", "api: marks tests as API endpoint tests"
    )