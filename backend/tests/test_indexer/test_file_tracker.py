import pytest
import tempfile
import time
from pathlib import Path

from indexer.file_tracker import FileChangeTracker


class TestFileChangeTracker:
    """Test the FileChangeTracker for monitoring vault file changes."""
    
    @pytest.fixture
    def tracker(self):
        """Create a FileChangeTracker instance for testing."""
        return FileChangeTracker()
    
    @pytest.fixture
    def sample_vault(self):
        """Create a temporary vault with sample files."""
        with tempfile.TemporaryDirectory() as temp_dir:
            vault_path = Path(temp_dir)
            
            # Create .obsidian folder
            (vault_path / ".obsidian").mkdir()
            
            # Create initial files
            (vault_path / "note1.md").write_text("# Note 1\nInitial content")
            (vault_path / "note2.md").write_text("# Note 2\nSecond note")
            
            # Create subfolder with file
            subfolder = vault_path / "folder"
            subfolder.mkdir()
            (subfolder / "note3.md").write_text("# Note 3\nSubfolder note")
            
            yield vault_path

    def test_tracker_initialization(self, tracker):
        """Test tracker initializes with empty state."""
        assert tracker is not None
        assert hasattr(tracker, 'scan_vault')
        assert hasattr(tracker, 'get_changed_files')
        assert hasattr(tracker, 'get_file_status')
        assert hasattr(tracker, 'save_state')
        assert hasattr(tracker, 'load_state')

    def test_initial_vault_scan(self, tracker, sample_vault):
        """Test initial scan of vault creates baseline."""
        changes = tracker.scan_vault(sample_vault)
        
        # Initial scan should report all files as new
        assert len(changes['added']) == 3
        assert len(changes['modified']) == 0
        assert len(changes['deleted']) == 0
        
        # Check that all expected files are found
        added_names = [Path(f).name for f in changes['added']]
        assert 'note1.md' in added_names
        assert 'note2.md' in added_names
        assert 'note3.md' in added_names

    def test_detect_new_files(self, tracker, sample_vault):
        """Test detection of newly added files."""
        # Initial scan
        tracker.scan_vault(sample_vault)
        
        # Add new file
        (sample_vault / "new_note.md").write_text("# New Note\nJust created")
        
        # Scan again
        changes = tracker.scan_vault(sample_vault)
        
        assert len(changes['added']) == 1
        assert len(changes['modified']) == 0
        assert len(changes['deleted']) == 0
        assert str(sample_vault / "new_note.md") in changes['added']

    def test_detect_modified_files(self, tracker, sample_vault):
        """Test detection of modified files."""
        # Initial scan
        tracker.scan_vault(sample_vault)
        
        # Wait a bit to ensure different timestamp
        time.sleep(0.1)
        
        # Modify existing file
        (sample_vault / "note1.md").write_text("# Note 1\nModified content")
        
        # Scan again
        changes = tracker.scan_vault(sample_vault)
        
        assert len(changes['added']) == 0
        assert len(changes['modified']) == 1
        assert len(changes['deleted']) == 0
        assert str(sample_vault / "note1.md") in changes['modified']

    def test_detect_deleted_files(self, tracker, sample_vault):
        """Test detection of deleted files."""
        # Initial scan
        tracker.scan_vault(sample_vault)
        
        # Delete file
        (sample_vault / "note2.md").unlink()
        
        # Scan again
        changes = tracker.scan_vault(sample_vault)
        
        assert len(changes['added']) == 0
        assert len(changes['modified']) == 0
        assert len(changes['deleted']) == 1
        assert str(sample_vault / "note2.md") in changes['deleted']

    def test_detect_multiple_changes(self, tracker, sample_vault):
        """Test detection of multiple simultaneous changes."""
        # Initial scan
        tracker.scan_vault(sample_vault)
        
        # Wait for different timestamp
        time.sleep(0.1)
        
        # Multiple changes
        (sample_vault / "note1.md").write_text("# Note 1\nModified")  # Modified
        (sample_vault / "note2.md").unlink()  # Deleted
        (sample_vault / "new_note.md").write_text("# New\nContent")  # Added
        
        # Scan again
        changes = tracker.scan_vault(sample_vault)
        
        assert len(changes['added']) == 1
        assert len(changes['modified']) == 1
        assert len(changes['deleted']) == 1
        
        assert str(sample_vault / "new_note.md") in changes['added']
        assert str(sample_vault / "note1.md") in changes['modified']
        assert str(sample_vault / "note2.md") in changes['deleted']

    def test_get_file_status(self, tracker, sample_vault):
        """Test getting status of specific files."""
        # Initial scan
        tracker.scan_vault(sample_vault)
        
        # Check status of existing files
        note1_path = sample_vault / "note1.md"
        status = tracker.get_file_status(note1_path)
        
        assert status is not None
        assert 'size' in status
        assert 'modified_time' in status
        assert 'hash' in status
        assert status['size'] > 0

    def test_get_file_status_nonexistent(self, tracker, sample_vault):
        """Test getting status of non-existent file."""
        tracker.scan_vault(sample_vault)
        
        nonexistent_path = sample_vault / "nonexistent.md"
        status = tracker.get_file_status(nonexistent_path)
        
        assert status is None

    def test_file_hash_calculation(self, tracker, sample_vault):
        """Test that file hash changes when content changes."""
        # Initial scan
        tracker.scan_vault(sample_vault)
        note1_path = sample_vault / "note1.md"
        initial_status = tracker.get_file_status(note1_path)
        initial_hash = initial_status['hash']
        
        # Modify file
        time.sleep(0.1)
        (sample_vault / "note1.md").write_text("# Note 1\nDifferent content")
        
        # Scan again
        tracker.scan_vault(sample_vault)
        new_status = tracker.get_file_status(note1_path)
        new_hash = new_status['hash']
        
        assert initial_hash != new_hash

    def test_save_and_load_state(self, tracker, sample_vault):
        """Test saving and loading tracker state."""
        # Initial scan
        tracker.scan_vault(sample_vault)
        
        # Save state to temporary file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            state_file = Path(f.name)
        
        try:
            tracker.save_state(state_file)
            
            # Create new tracker and load state
            new_tracker = FileChangeTracker()
            new_tracker.load_state(state_file)
            
            # Should have same file information
            note1_path = sample_vault / "note1.md"
            original_status = tracker.get_file_status(note1_path)
            loaded_status = new_tracker.get_file_status(note1_path)
            
            assert original_status == loaded_status
            
        finally:
            state_file.unlink()

    def test_state_persistence_across_scans(self, tracker, sample_vault):
        """Test that state persists correctly across multiple scans."""
        # Initial scan
        tracker.scan_vault(sample_vault)
        
        # Second scan should show no changes
        changes = tracker.scan_vault(sample_vault)
        
        assert len(changes['added']) == 0
        assert len(changes['modified']) == 0
        assert len(changes['deleted']) == 0

    def test_ignore_obsidian_folder(self, tracker, sample_vault):
        """Test that .obsidian folder changes are ignored."""
        # Initial scan
        tracker.scan_vault(sample_vault)
        
        # Add file to .obsidian folder
        (sample_vault / ".obsidian" / "config.json").write_text('{"setting": "value"}')
        
        # Scan again
        changes = tracker.scan_vault(sample_vault)
        
        # Should not detect changes in .obsidian folder
        assert len(changes['added']) == 0
        assert len(changes['modified']) == 0
        assert len(changes['deleted']) == 0

    def test_ignore_trash_folder(self, tracker, sample_vault):
        """Test that .trash folder changes are ignored."""
        # Create .trash folder
        trash_folder = sample_vault / ".trash"
        trash_folder.mkdir()
        
        # Initial scan
        tracker.scan_vault(sample_vault)
        
        # Add file to .trash folder
        (trash_folder / "deleted.md").write_text("# Deleted note")
        
        # Scan again
        changes = tracker.scan_vault(sample_vault)
        
        # Should not detect changes in .trash folder
        assert len(changes['added']) == 0

    def test_get_changed_files_since_timestamp(self, tracker, sample_vault):
        """Test getting files changed since specific timestamp."""
        # Initial scan
        tracker.scan_vault(sample_vault)
        
        # Record timestamp
        checkpoint_time = time.time()
        time.sleep(0.1)
        
        # Make changes
        (sample_vault / "note1.md").write_text("# Note 1\nChanged after checkpoint")
        (sample_vault / "new_note.md").write_text("# New\nCreated after checkpoint")
        
        # Scan
        tracker.scan_vault(sample_vault)
        
        # Get files changed since checkpoint
        changed_files = tracker.get_changed_files(since_timestamp=checkpoint_time)
        
        assert len(changed_files) == 2
        changed_names = [Path(f).name for f in changed_files]
        assert 'note1.md' in changed_names
        assert 'new_note.md' in changed_names

    def test_batch_processing_capability(self, tracker, sample_vault):
        """Test handling of large numbers of files efficiently."""
        # Create many files
        for i in range(100):
            (sample_vault / f"note_{i:03d}.md").write_text(f"# Note {i}\nContent {i}")
        
        # Should handle large vault efficiently
        changes = tracker.scan_vault(sample_vault)
        
        assert len(changes['added']) == 103  # 100 new + 3 original
        
        # Modify some files
        time.sleep(0.1)
        for i in range(0, 50, 10):  # Modify every 10th file
            (sample_vault / f"note_{i:03d}.md").write_text(f"# Note {i}\nModified content {i}")
        
        changes = tracker.scan_vault(sample_vault)
        assert len(changes['modified']) == 5  # Every 10th from 0-40