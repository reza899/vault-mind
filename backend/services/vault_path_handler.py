"""
Cross-platform vault path handler with security validation.
Converts user filesystem paths to container paths safely.
"""
import os
from pathlib import Path
from typing import Optional


class VaultPathHandler:
    """Handles cross-platform vault path conversion and validation."""
    
    def __init__(self):
        self.host_prefix = os.getenv('HOST_MOUNT_PREFIX', '')
    
    def get_container_path(self, user_path: str) -> str:
        """Convert user filesystem path to container path."""
        if not user_path:
            raise ValueError("Path cannot be empty")
        
        # Normalize path for cross-platform compatibility
        normalized_path = str(Path(user_path).resolve())
        
        # Add host prefix for container access
        return f"{self.host_prefix}{normalized_path}"
    
    def validate_vault_path(self, user_path: str) -> tuple[bool, Optional[str]]:
        """
        Validate vault path with security checks.
        Returns (is_valid, error_message)
        """
        if not user_path or not user_path.strip():
            return False, "Vault path cannot be empty"
        
        try:
            # Get container path
            container_path = self.get_container_path(user_path)
            
            # Security validations
            if '..' in user_path:
                return False, "Path traversal not allowed"
            
            if not os.path.exists(container_path):
                return False, f"Vault path does not exist: {user_path}"
            
            if not os.path.isdir(container_path):
                return False, f"Path is not a directory: {user_path}"
            
            # Check if directory is readable
            if not os.access(container_path, os.R_OK):
                return False, f"Directory not readable: {user_path}"
            
            return True, None
            
        except Exception as e:
            return False, f"Path validation error: {str(e)}"
    
    def get_vault_files(self, user_path: str, extensions: list[str] = None) -> list[str]:
        """Get list of vault files with optional extension filtering."""
        if extensions is None:
            extensions = ['.md', '.txt']
        
        is_valid, error = self.validate_vault_path(user_path)
        if not is_valid:
            raise ValueError(error)
        
        container_path = self.get_container_path(user_path)
        vault_files = []
        
        for root, _, files in os.walk(container_path):
            for file in files:
                if any(file.lower().endswith(ext) for ext in extensions):
                    # Return original user path structure, not container path
                    relative_path = os.path.relpath(os.path.join(root, file), container_path)
                    vault_files.append(os.path.join(user_path, relative_path))
        
        return vault_files