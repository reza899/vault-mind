"""
Request models for collection management API endpoints.
Defines Pydantic models for all collection-related requests.
"""
from typing import Dict, Any, List, Optional, Union
from pydantic import BaseModel, Field, validator
import re
from enum import Enum


class ReindexMode(str, Enum):
    """Re-indexing mode options."""
    FULL = "full"


class CreateCollectionRequest(BaseModel):
    """Request model for creating a new collection."""
    
    collection_name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Unique identifier for the collection (alphanumeric, underscores, hyphens only)"
    )
    vault_path: str = Field(
        ...,
        description="Filesystem path to the Obsidian vault directory"
    )
    description: Optional[str] = Field(
        None,
        max_length=500,
        description="Optional description of the vault"
    )
    config: Optional[Dict[str, Any]] = Field(
        None,
        description="Optional configuration overrides"
    )
    
    @validator("collection_name")
    def validate_collection_name(cls, v):
        """Validate collection name format."""
        if not re.match(r'^[a-zA-Z0-9_-]+$', v):
            raise ValueError("Collection name must contain only alphanumeric characters, underscores, and hyphens")
        return v.lower()  # Normalize to lowercase
    
    @validator("vault_path")
    def validate_vault_path(cls, v):
        """Basic vault path validation."""
        if not v or len(v.strip()) == 0:
            raise ValueError("Vault path cannot be empty")
        return v.strip()
    
    class Config:
        json_schema_extra = {
            "example": {
                "collection_name": "my_vault",
                "vault_path": "/Users/username/Documents/ObsidianVault",
                "description": "My main knowledge base",
                "config": {
                    "chunk_size": 1000,
                    "chunk_overlap": 200,
                    "embedding_model": "all-MiniLM-L6-v2"
                }
            }
        }


class UpdateCollectionConfigRequest(BaseModel):
    """Request model for updating collection configuration."""
    
    chunk_size: Optional[int] = Field(
        None,
        ge=100,
        le=4000,
        description="Text chunk size in characters (triggers re-indexing if changed)"
    )
    chunk_overlap: Optional[int] = Field(
        None,
        ge=0,
        le=1000,
        description="Overlap between text chunks in characters"
    )
    embedding_model: Optional[str] = Field(
        None,
        description="Embedding model name (triggers re-indexing if changed)"
    )
    ignore_patterns: Optional[List[str]] = Field(
        None,
        description="Glob patterns for files/folders to ignore"
    )
    schedule: Optional[str] = Field(
        None,
        description="Cron expression for automatic re-indexing"
    )
    enabled: Optional[bool] = Field(
        None,
        description="Enable/disable automatic processing"
    )
    
    @validator("chunk_overlap")
    def validate_chunk_overlap(cls, v, values):
        """Ensure chunk overlap is smaller than chunk size."""
        if v is not None and 'chunk_size' in values and values['chunk_size'] is not None:
            if v >= values['chunk_size']:
                raise ValueError("Chunk overlap must be smaller than chunk size")
        return v
    
    @validator("ignore_patterns")
    def validate_ignore_patterns(cls, v):
        """Validate ignore patterns are not empty."""
        if v is not None:
            v = [pattern.strip() for pattern in v if pattern.strip()]
            if len(v) == 0:
                return None
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "chunk_size": 1200,
                "chunk_overlap": 150,
                "embedding_model": "all-MiniLM-L6-v2",
                "ignore_patterns": ["*.tmp", "drafts/*", ".obsidian/*"],
                "schedule": "0 2 * * *",  # Daily at 2 AM
                "enabled": True
            }
        }


class ReindexCollectionRequest(BaseModel):
    """Request model for re-indexing a collection."""
    
    mode: ReindexMode = Field(
        ReindexMode.FULL,
        description="Re-indexing mode: 'full' (complete re-index)"
    )
    force: bool = Field(
        False,
        description="Force re-indexing even if already running"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "mode": "full",
                "force": False
            }
        }


class SearchCollectionRequest(BaseModel):
    """Request model for searching within a collection."""
    
    query: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        description="Search query text"
    )
    limit: int = Field(
        10,
        ge=1,
        le=100,
        description="Number of results to return"
    )
    similarity_threshold: float = Field(
        0.7,
        ge=0.0,
        le=1.0,
        description="Minimum similarity score for results"
    )
    filters: Optional[Dict[str, Any]] = Field(
        None,
        description="Optional metadata filters"
    )
    include_metadata: bool = Field(
        True,
        description="Include document metadata in results"
    )
    include_content: bool = Field(
        True,
        description="Include document content in results"
    )
    
    @validator("query")
    def validate_query(cls, v):
        """Validate search query."""
        if not v or len(v.strip()) == 0:
            raise ValueError("Search query cannot be empty")
        return v.strip()
    
    class Config:
        json_schema_extra = {
            "example": {
                "query": "machine learning algorithms",
                "limit": 20,
                "similarity_threshold": 0.75,
                "filters": {
                    "file_type": "markdown",
                    "folder": "research",
                    "tags": ["AI", "ML"]
                },
                "include_metadata": True,
                "include_content": True
            }
        }


class CollectionFilterRequest(BaseModel):
    """Request model for advanced collection filtering."""
    
    file_types: Optional[List[str]] = Field(
        None,
        description="Filter by file extensions (e.g., ['.md', '.txt'])"
    )
    date_range: Optional[Dict[str, str]] = Field(
        None,
        description="Date range filter with 'start' and 'end' keys (ISO format)"
    )
    folder_paths: Optional[List[str]] = Field(
        None,
        description="Filter by folder paths (relative to vault root)"
    )
    tags: Optional[List[str]] = Field(
        None,
        description="Filter by Obsidian tags"
    )
    file_size_range: Optional[Dict[str, int]] = Field(
        None,
        description="File size range with 'min' and 'max' keys (in bytes)"
    )
    metadata_filters: Optional[Dict[str, Union[str, int, float, bool]]] = Field(
        None,
        description="Custom metadata field filters"
    )
    
    @validator("file_types")
    def validate_file_types(cls, v):
        """Validate file type extensions."""
        if v is not None:
            valid_types = []
            for file_type in v:
                if not file_type.startswith('.'):
                    file_type = '.' + file_type
                valid_types.append(file_type.lower())
            return valid_types
        return v
    
    @validator("date_range")
    def validate_date_range(cls, v):
        """Validate date range format."""
        if v is not None:
            if 'start' not in v and 'end' not in v:
                raise ValueError("Date range must include 'start' or 'end' key")
            # Basic ISO date format validation would go here
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "file_types": [".md", ".txt"],
                "date_range": {
                    "start": "2024-01-01T00:00:00Z",
                    "end": "2024-12-31T23:59:59Z"
                },
                "folder_paths": ["research/", "projects/"],
                "tags": ["important", "todo"],
                "file_size_range": {
                    "min": 1024,
                    "max": 1048576
                },
                "metadata_filters": {
                    "author": "john_doe",
                    "priority": 5,
                    "reviewed": True
                }
            }
        }


class BulkOperationRequest(BaseModel):
    """Request model for bulk operations on multiple collections."""
    
    collection_names: List[str] = Field(
        ...,
        min_items=1,
        max_items=10,
        description="List of collection names to operate on"
    )
    operation: str = Field(
        ...,
        description="Operation to perform: 'reindex', 'health_check', 'update_config'"
    )
    parameters: Optional[Dict[str, Any]] = Field(
        None,
        description="Operation-specific parameters"
    )
    
    @validator("collection_names")
    def validate_collection_names(cls, v):
        """Validate collection names."""
        if len(set(v)) != len(v):
            raise ValueError("Duplicate collection names are not allowed")
        
        for name in v:
            if not re.match(r'^[a-zA-Z0-9_-]+$', name):
                raise ValueError(f"Invalid collection name: {name}")
        
        return [name.lower() for name in v]
    
    @validator("operation")
    def validate_operation(cls, v):
        """Validate operation type."""
        allowed_operations = {'reindex', 'health_check', 'update_config', 'pause', 'resume'}
        if v not in allowed_operations:
            raise ValueError(f"Invalid operation. Must be one of: {', '.join(allowed_operations)}")
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "collection_names": ["vault_main", "vault_work", "vault_research"],
                "operation": "health_check",
                "parameters": {}
            }
        }


class CollectionScheduleRequest(BaseModel):
    """Request model for collection scheduling operations."""
    
    schedule_type: str = Field(
        ...,
        description="Schedule type: 'cron', 'interval', 'once'"
    )
    expression: str = Field(
        ...,
        description="Schedule expression (cron format for 'cron' type)"
    )
    enabled: bool = Field(
        True,
        description="Whether the schedule is enabled"
    )
    operation: str = Field(
        "reindex",
        description="Operation to schedule: 'reindex', 'health_check'"
    )
    parameters: Optional[Dict[str, Any]] = Field(
        None,
        description="Operation parameters"
    )
    
    @validator("schedule_type")
    def validate_schedule_type(cls, v):
        """Validate schedule type."""
        allowed_types = {'cron', 'interval', 'once'}
        if v not in allowed_types:
            raise ValueError(f"Invalid schedule type. Must be one of: {', '.join(allowed_types)}")
        return v
    
    @validator("operation")
    def validate_operation(cls, v):
        """Validate scheduled operation."""
        allowed_operations = {'reindex', 'health_check'}
        if v not in allowed_operations:
            raise ValueError(f"Invalid operation. Must be one of: {', '.join(allowed_operations)}")
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "schedule_type": "cron",
                "expression": "0 2 * * *",  # Daily at 2 AM
                "enabled": True,
                "operation": "reindex",
                "parameters": {
                    "mode": "full"
                }
            }
        }


class CollectionExportRequest(BaseModel):
    """Request model for exporting collection data."""
    
    format: str = Field(
        "json",
        description="Export format: 'json', 'csv', 'markdown'"
    )
    include_content: bool = Field(
        True,
        description="Include document content in export"
    )
    include_metadata: bool = Field(
        True,
        description="Include document metadata in export"
    )
    include_embeddings: bool = Field(
        False,
        description="Include embeddings in export (JSON only)"
    )
    filters: Optional[CollectionFilterRequest] = Field(
        None,
        description="Optional filters to apply during export"
    )
    
    @validator("format")
    def validate_format(cls, v):
        """Validate export format."""
        allowed_formats = {'json', 'csv', 'markdown'}
        if v not in allowed_formats:
            raise ValueError(f"Invalid format. Must be one of: {', '.join(allowed_formats)}")
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "format": "json",
                "include_content": True,
                "include_metadata": True,
                "include_embeddings": False,
                "filters": {
                    "file_types": [".md"],
                    "tags": ["important"]
                }
            }
        }