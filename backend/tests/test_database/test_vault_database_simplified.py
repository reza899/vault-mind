"""
Tests for the unified VaultDatabase class.
Tests the merged functionality from ChromaClient and CollectionManager.
"""
import pytest
import tempfile
import shutil

from database import VaultDatabase


class TestVaultDatabase:
    """Test the unified VaultDatabase class."""
    
    async def _create_test_db(self):
        """Create a temporary VaultDatabase for testing."""
        temp_dir = tempfile.mkdtemp()
        db = VaultDatabase(temp_dir)
        await db.connect()
        return db, temp_dir
    
    @pytest.mark.asyncio
    async def test_connection(self):
        """Test database connection."""
        temp_dir = tempfile.mkdtemp()
        try:
            db = VaultDatabase(temp_dir)
            
            # Initially not connected
            assert not db.is_connected()
            
            # Connect
            await db.connect()
            assert db.is_connected()
            
            # Disconnect
            await db.disconnect()
            assert not db.is_connected()
            
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)
    
    @pytest.mark.asyncio
    async def test_health_check(self):
        """Test health check functionality."""
        db, temp_dir = await self._create_test_db()
        try:
            health = await db.health_check()
            
            assert health['status'] == 'healthy'
            assert health['connected'] is True
            assert 'heartbeat' in health
            assert 'persist_directory' in health
        finally:
            await db.disconnect()
            shutil.rmtree(temp_dir, ignore_errors=True)
    
    @pytest.mark.asyncio
    async def test_create_vault_collection(self):
        """Test creating a vault collection."""
        db, temp_dir = await self._create_test_db()
        try:
            collection = await db.create_vault_collection(
                vault_name="test_vault",
                vault_path="/path/to/test/vault",
                description="Test vault description"
            )
            
            assert collection is not None
            assert collection.name == "vault_test_vault"
            assert collection.metadata['vault_name'] == "test_vault"
            assert collection.metadata['vault_path'] == "/path/to/test/vault"
            assert collection.metadata['description'] == "Test vault description"
            assert collection.metadata['collection_type'] == "vault"
        finally:
            await db.disconnect()
            shutil.rmtree(temp_dir, ignore_errors=True)
    
    @pytest.mark.asyncio
    async def test_get_vault_collection(self):
        """Test getting an existing vault collection."""
        db, temp_dir = await self._create_test_db()
        try:
            # Create collection first
            await db.create_vault_collection(
                vault_name="test_vault",
                vault_path="/path/to/test/vault"
            )
            
            # Get the collection
            collection = await db.get_vault_collection("test_vault")
            
            assert collection is not None
            assert collection.name == "vault_test_vault"
            assert collection.metadata['vault_name'] == "test_vault"
        finally:
            await db.disconnect()
            shutil.rmtree(temp_dir, ignore_errors=True)
    
    @pytest.mark.asyncio
    async def test_get_nonexistent_collection(self):
        """Test getting a non-existent collection."""
        db, temp_dir = await self._create_test_db()
        try:
            with pytest.raises(ValueError, match="not found"):
                await db.get_vault_collection("nonexistent_vault")
        finally:
            await db.disconnect()
            shutil.rmtree(temp_dir, ignore_errors=True)
    
    @pytest.mark.asyncio
    async def test_delete_vault_collection(self):
        """Test deleting a vault collection."""
        db, temp_dir = await self._create_test_db()
        try:
            # Create collection first
            await db.create_vault_collection(
                vault_name="test_vault",
                vault_path="/path/to/test/vault"
            )
            
            # Delete the collection
            result = await db.delete_vault_collection("test_vault")
            assert result is True
            
            # Verify it's deleted
            with pytest.raises(ValueError, match="not found"):
                await db.get_vault_collection("test_vault")
        finally:
            await db.disconnect()
            shutil.rmtree(temp_dir, ignore_errors=True)
    
    @pytest.mark.asyncio
    async def test_list_vault_collections(self):
        """Test listing vault collections."""
        db, temp_dir = await self._create_test_db()
        try:
            # Initially empty
            collections = await db.list_vault_collections()
            assert len(collections) == 0
            
            # Create a few collections
            await db.create_vault_collection("vault1", "/path/1")
            await db.create_vault_collection("vault2", "/path/2")
            
            # List collections
            collections = await db.list_vault_collections()
            assert len(collections) == 2
            
            vault_names = [col['name'] for col in collections]
            assert "vault1" in vault_names
            assert "vault2" in vault_names
        finally:
            await db.disconnect()
            shutil.rmtree(temp_dir, ignore_errors=True)
    
    @pytest.mark.asyncio
    async def test_vault_name_validation(self):
        """Test vault name validation."""
        db, temp_dir = await self._create_test_db()
        try:
            # Test empty name
            with pytest.raises(ValueError, match="non-empty string"):
                await db.create_vault_collection("", "/path")
            
            # Test None name
            with pytest.raises(ValueError, match="non-empty string"):
                await db.create_vault_collection(None, "/path")
            
            # Test name with path separators
            with pytest.raises(ValueError, match="path separators"):
                await db.create_vault_collection("vault/with/path", "/path")
            
            with pytest.raises(ValueError, match="path separators"):
                await db.create_vault_collection("vault\\with\\path", "/path")
        finally:
            await db.disconnect()
            shutil.rmtree(temp_dir, ignore_errors=True)
    
    @pytest.mark.asyncio
    async def test_vault_name_sanitization(self):
        """Test vault name sanitization."""
        db, temp_dir = await self._create_test_db()
        try:
            # Create collection with special characters
            collection = await db.create_vault_collection(
                vault_name="Test Vault with Spaces & Special!",
                vault_path="/path/to/vault"
            )
            
            # Collection name should be sanitized
            assert collection.name == "vault_test_vault_with_spaces_special"
            assert collection.metadata['vault_name'] == "Test Vault with Spaces & Special!"
        finally:
            await db.disconnect()
            shutil.rmtree(temp_dir, ignore_errors=True)
    
    @pytest.mark.asyncio
    async def test_ensure_connected_validation(self):
        """Test that operations require connection."""
        temp_dir = tempfile.mkdtemp()
        try:
            db = VaultDatabase(temp_dir)
            # Don't connect
            
            with pytest.raises(RuntimeError, match="not connected"):
                await db.create_vault_collection("test", "/path")
            
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)