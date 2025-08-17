"""
File change tracker for monitoring Obsidian vault modifications.
Tracks file additions, modifications, and deletions efficiently.
"""
import hashlib
import json
import os
import time
from pathlib import Path
from typing import Dict, List, Any, Optional


class FileChangeTracker:
    """Tracks file changes in Obsidian vaults using timestamps and content hashes."""
    
    def __init__(self):
        """Initialize the file change tracker."""
        # Internal state: path -> file info
        self._file_states: Dict[str, Dict[str, Any]] = {}
        
        # Excluded folders (same as parsers)
        self.excluded_folders = {'.obsidian', '.trash', 'templates'}
        
        # Supported file extensions
        self.supported_extensions = {'.md', '.txt'}
    
    def scan_vault(self, vault_path: Path) -> Dict[str, List[str]]:
        """
        Scan vault for changes and return categorized file lists.
        
        Returns:
            Dict with 'added', 'modified', 'deleted' lists of file paths
        """
        if not vault_path.exists() or not vault_path.is_dir():
            raise ValueError(f"Invalid vault path: {vault_path}")
        
        # Get current vault files
        current_files = self._discover_vault_files(vault_path)
        current_states = {}
        
        # Calculate current file states
        for file_path in current_files:
            current_states[str(file_path)] = self._get_file_info(file_path)
        
        # Compare with previous state
        changes = self._compare_states(current_states)
        
        # Update internal state
        self._file_states = current_states
        
        return changes
    
    def get_file_status(self, file_path: Path) -> Optional[Dict[str, Any]]:
        """Get current status information for a specific file."""
        file_str = str(file_path)
        return self._file_states.get(file_str)
    
    def get_changed_files(self, since_timestamp: Optional[float] = None) -> List[str]:
        """Get list of files changed since specified timestamp."""
        if since_timestamp is None:
            return list(self._file_states.keys())
        
        changed_files = []
        for file_path, file_info in self._file_states.items():
            if file_info['modified_time'] > since_timestamp:
                changed_files.append(file_path)
        
        return changed_files
    
    def save_state(self, state_file: Path) -> None:
        """Save current state to JSON file."""
        state_data = {
            'file_states': self._file_states,
            'timestamp': time.time()
        }
        
        with open(state_file, 'w', encoding='utf-8') as f:
            json.dump(state_data, f, indent=2)
    
    def load_state(self, state_file: Path) -> None:
        """Load state from JSON file."""
        if not state_file.exists():
            return
        
        try:
            with open(state_file, 'r', encoding='utf-8') as f:
                state_data = json.load(f)
            
            self._file_states = state_data.get('file_states', {})
        except (json.JSONDecodeError, KeyError):
            # If state file is corrupted, start fresh
            self._file_states = {}
    
    def _discover_vault_files(self, vault_path: Path) -> List[Path]:
        """Discover all trackable files in the vault."""
        files = []
        
        for root, dirs, filenames in os.walk(vault_path):
            root_path = Path(root)
            
            # Skip excluded directories
            dirs[:] = [d for d in dirs if d not in self.excluded_folders]
            
            # Find supported files
            for filename in filenames:
                file_path = root_path / filename
                if file_path.suffix in self.supported_extensions:
                    files.append(file_path)
        
        return sorted(files)
    
    def _get_file_info(self, file_path: Path) -> Dict[str, Any]:
        """Get comprehensive file information for change detection."""
        try:
            stat_info = file_path.stat()
            
            # Read file content for hash calculation
            with open(file_path, 'rb') as f:
                content = f.read()
            
            # Calculate content hash
            content_hash = hashlib.md5(content).hexdigest()
            
            return {
                'size': stat_info.st_size,
                'modified_time': stat_info.st_mtime,
                'hash': content_hash
            }
        except (OSError, IOError):
            # File might be deleted or inaccessible
            return {
                'size': 0,
                'modified_time': 0,
                'hash': ''
            }
    
    def _compare_states(self, current_states: Dict[str, Dict[str, Any]]) -> Dict[str, List[str]]:
        """Compare current state with previous state to detect changes."""
        previous_files = set(self._file_states.keys())
        current_files = set(current_states.keys())
        
        # Categorize changes
        added_files = list(current_files - previous_files)
        deleted_files = list(previous_files - current_files)
        
        # Check for modifications in existing files
        modified_files = []
        common_files = current_files & previous_files
        
        for file_path in common_files:
            current_info = current_states[file_path]
            previous_info = self._file_states[file_path]
            
            # Check if file was modified (using hash for accuracy)
            if current_info['hash'] != previous_info['hash']:
                modified_files.append(file_path)
        
        return {
            'added': sorted(added_files),
            'modified': sorted(modified_files),
            'deleted': sorted(deleted_files)
        }