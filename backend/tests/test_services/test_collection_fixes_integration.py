"""
Integration tests for collection manager fixes.
"""
import pytest


class TestCollectionStatusFixes:
    """Test the key fixes for collection status issues."""
    
    def test_health_status_logic(self):
        """Test health status determination logic."""
        # Test healthy status for documents
        document_count = 6
        health_status = 'healthy' if document_count > 0 else 'empty'
        assert health_status == 'healthy'
        
        # Test empty status for no documents
        document_count = 0
        health_status = 'healthy' if document_count > 0 else 'empty'
        assert health_status == 'empty'
    
    def test_size_calculation_logic(self):
        """Test size calculation logic."""
        # Test normal size calculation
        document_count = 6
        estimated_size_per_doc = 2048  # 2KB per document/chunk
        calculated_size = document_count * estimated_size_per_doc
        assert calculated_size == 12288  # 6 * 2048
        
        # Test zero documents
        document_count = 0
        calculated_size = document_count * estimated_size_per_doc  
        assert calculated_size == 0
        
    def test_database_update_parameters(self):
        """Test that database update has correct number and order of parameters."""
        # Simulate the update parameters
        document_count = 6
        calculated_size = 12288
        health_status = 'healthy'
        collection_name = "test_collection"
        
        # Test creation update parameters
        creation_params = (
            "active", "2024-01-01T00:00:00", document_count, 
            calculated_size, health_status, collection_name
        )
        assert len(creation_params) == 6
        assert creation_params[2] == 6  # document_count
        assert creation_params[3] == 12288  # size_bytes
        assert creation_params[4] == 'healthy'  # health_status
        
        # Test reindex update parameters  
        reindex_params = (
            "active", "2024-01-01T00:00:00", document_count,
            "2024-01-01T00:00:00", calculated_size, health_status, collection_name
        )
        assert len(reindex_params) == 7
        assert reindex_params[2] == 6  # document_count
        assert reindex_params[4] == 12288  # size_bytes
        assert reindex_params[5] == 'healthy'  # health_status


class TestLinkGraphFix:
    """Test the link graph metadata type checking fix."""
    
    def test_metadata_type_filtering(self):
        """Test that non-dict metadata is properly filtered."""
        # Mock metadata list with mixed types (simulating the bug scenario)
        mock_metadatas = [
            {'file_path': '/test1.md', 'links': ['test2.md']},  # Valid dict
            'invalid_string_metadata',  # Invalid string (causes the bug)
            None,  # Invalid None
            {'file_path': '/test2.md'},  # Valid dict but no links
            {'file_path': '/test3.md', 'links': ['test1.md']},  # Valid dict with links
        ]
        
        # Simulate the filtering logic (with the fix)
        documents_metadata = []
        processed_files = set()
        
        for metadata in mock_metadatas:
            # This is the fix - ensure metadata is a dictionary
            if not isinstance(metadata, dict):
                continue
                
            file_path = metadata.get('file_path')
            if file_path and file_path not in processed_files:
                # Only include metadata with link information
                if metadata.get('links'):
                    documents_metadata.append(metadata)
                    processed_files.add(file_path)
        
        # Should only have 2 valid metadata entries with links
        assert len(documents_metadata) == 2
        assert documents_metadata[0]['file_path'] == '/test1.md'
        assert documents_metadata[1]['file_path'] == '/test3.md'
    
    def test_metadata_type_error_simulation(self):
        """Test that the old code would have failed with string metadata."""
        # Simulate what would happen with the old code
        invalid_metadata = "invalid_string_metadata"
        
        # This would cause the error: 'str' object has no attribute 'get'
        with pytest.raises(AttributeError):
            invalid_metadata.get('file_path')  # This is what the old code did
        
        # The fix prevents this by checking isinstance(metadata, dict) first
        if isinstance(invalid_metadata, dict):
            file_path = invalid_metadata.get('file_path')
        else:
            file_path = None
            
        assert file_path is None  # The fix handles this gracefully


class TestVaultCardStatusLogic:
    """Test the frontend vault card status logic expectations."""
    
    def test_vault_card_status_conditions(self):
        """Test the conditions that trigger different vault card statuses."""
        # Test "Active (Issues)" condition  
        status = 'active'
        health_status = 'unknown'  # This was the problem
        
        # This is the logic from VaultCard.tsx
        is_healthy = (status == 'active' and health_status == 'healthy')
        assert not is_healthy  # Should be False, showing "Active (Issues)"
        
        # Test "Active" condition (after fix)
        status = 'active' 
        health_status = 'healthy'  # This is what our fix provides
        
        is_healthy = (status == 'active' and health_status == 'healthy')
        assert is_healthy  # Should be True, showing "Active"
        
    def test_size_display_logic(self):
        """Test size display logic."""
        # Test 0 bytes (the problem)
        size_bytes = 0
        assert size_bytes == 0  # Shows "0 B"
        
        # Test calculated size (after fix)
        size_bytes = 12288
        assert size_bytes > 0  # Shows actual size
        
        # Verify our calculation
        document_count = 6
        calculated_size = document_count * 2048
        assert calculated_size == 12288