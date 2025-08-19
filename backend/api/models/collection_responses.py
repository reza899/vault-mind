"""
Response models for collection management API endpoints.
Defines Pydantic models for all collection-related responses.
"""
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum


class CollectionStatus(str, Enum):
    """Collection status enumeration."""
    CREATED = "created"
    INDEXING = "indexing"
    ACTIVE = "active"
    ERROR = "error"
    PAUSED = "paused"
    DELETING = "deleting"


class HealthStatus(str, Enum):
    """Health status enumeration."""
    HEALTHY = "healthy"
    WARNING = "warning"
    ERROR = "error"
    UNKNOWN = "unknown"


class CollectionResponse(BaseModel):
    """Basic collection information response."""
    
    collection_name: str = Field(..., description="Collection identifier")
    vault_path: str = Field(..., description="Path to the Obsidian vault")
    description: Optional[str] = Field(None, description="Collection description")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    last_indexed_at: Optional[datetime] = Field(None, description="Last indexing timestamp")
    document_count: int = Field(0, description="Number of indexed documents")
    size_bytes: int = Field(0, description="Estimated collection size in bytes")
    status: CollectionStatus = Field(..., description="Current collection status")
    health_status: HealthStatus = Field(HealthStatus.UNKNOWN, description="Collection health")
    error_message: Optional[str] = Field(None, description="Last error message if any")
    
    class Config:
        json_schema_extra = {
            "example": {
                "collection_name": "my_vault",
                "vault_path": "/Users/username/Documents/ObsidianVault",
                "description": "My main knowledge base",
                "created_at": "2024-01-15T10:30:00Z",
                "updated_at": "2024-01-15T14:22:00Z",
                "last_indexed_at": "2024-01-15T14:22:00Z",
                "document_count": 247,
                "size_bytes": 1048576,
                "status": "active",
                "health_status": "healthy",
                "error_message": None
            }
        }


class PaginationResponse(BaseModel):
    """Pagination metadata for list responses."""
    
    current_page: int = Field(..., description="Current page number")
    total_pages: int = Field(..., description="Total number of pages")
    total_items: int = Field(..., description="Total number of items")
    items_per_page: int = Field(..., description="Number of items per page")
    has_next: bool = Field(..., description="Whether there are more pages")
    has_previous: bool = Field(..., description="Whether there are previous pages")
    
    class Config:
        json_schema_extra = {
            "example": {
                "current_page": 1,
                "total_pages": 3,
                "total_items": 25,
                "items_per_page": 10,
                "has_next": True,
                "has_previous": False
            }
        }


class CollectionListResponse(BaseModel):
    """Response for listing collections with pagination."""
    
    collections: List[CollectionResponse] = Field(..., description="List of collections")
    pagination: PaginationResponse = Field(..., description="Pagination metadata")
    
    class Config:
        json_schema_extra = {
            "example": {
                "collections": [
                    {
                        "collection_name": "my_vault",
                        "vault_path": "/Users/username/Documents/ObsidianVault",
                        "document_count": 247,
                        "status": "active",
                        "health_status": "healthy"
                    }
                ],
                "pagination": {
                    "current_page": 1,
                    "total_pages": 1,
                    "total_items": 1,
                    "items_per_page": 50,
                    "has_next": False,
                    "has_previous": False
                }
            }
        }


class CollectionStatusResponse(BaseModel):
    """Detailed collection status response."""
    
    collection_name: str = Field(..., description="Collection identifier")
    status: CollectionStatus = Field(..., description="Current status")
    indexing_progress: Optional[Dict[str, Any]] = Field(None, description="Indexing progress details")
    file_counts: Dict[str, int] = Field(..., description="File count statistics")
    error_logs: List[Dict[str, Any]] = Field([], description="Recent error logs")
    performance_metrics: Dict[str, Any] = Field(..., description="Performance statistics")
    active_jobs: List[str] = Field([], description="Active job IDs")
    
    class Config:
        json_schema_extra = {
            "example": {
                "collection_name": "my_vault",
                "status": "indexing",
                "indexing_progress": {
                    "percentage": 75.5,
                    "current_file": "notes/machine-learning.md",
                    "files_processed": 186,
                    "total_files": 247,
                    "documents_created": 1247,
                    "chunks_created": 5832,
                    "processing_rate": 12.5,
                    "eta_seconds": 45
                },
                "file_counts": {
                    "total_files": 247,
                    "markdown_files": 240,
                    "processed_files": 186,
                    "failed_files": 2,
                    "skipped_files": 5
                },
                "error_logs": [
                    {
                        "timestamp": "2024-01-15T14:20:00Z",
                        "level": "warning",
                        "message": "Failed to parse file: corrupted.md",
                        "details": {"file_path": "notes/corrupted.md", "error": "Invalid encoding"}
                    }
                ],
                "performance_metrics": {
                    "avg_processing_time_ms": 125.5,
                    "documents_per_second": 8.2,
                    "memory_usage_mb": 256,
                    "last_update_time": "2024-01-15T14:22:30Z"
                },
                "active_jobs": ["job_abc123"]
            }
        }


class CollectionHealthResponse(BaseModel):
    """Collection health check response."""
    
    collection_name: str = Field(..., description="Collection identifier")
    status: HealthStatus = Field(..., description="Overall health status")
    checks: Dict[str, Dict[str, Any]] = Field(..., description="Individual health checks")
    recommendations: List[str] = Field([], description="Recommended actions")
    last_check_time: datetime = Field(..., description="Last health check timestamp")
    
    class Config:
        json_schema_extra = {
            "example": {
                "collection_name": "my_vault",
                "status": "healthy",
                "checks": {
                    "chromadb_connection": {
                        "status": "healthy",
                        "message": "ChromaDB collection accessible",
                        "response_time_ms": 15
                    },
                    "vault_path": {
                        "status": "healthy",
                        "message": "Vault directory accessible",
                        "files_found": 247
                    },
                    "configuration": {
                        "status": "healthy", 
                        "message": "All settings valid"
                    },
                    "indexing_status": {
                        "status": "healthy",
                        "message": "Index up to date",
                        "last_indexed": "2024-01-15T14:22:00Z"
                    }
                },
                "recommendations": [],
                "last_check_time": "2024-01-15T15:00:00Z"
            }
        }


class CollectionConfigResponse(BaseModel):
    """Collection configuration response."""
    
    collection_name: str = Field(..., description="Collection identifier")
    vault_path: str = Field(..., description="Vault directory path")
    chunk_size: int = Field(1000, description="Text chunk size in characters")
    chunk_overlap: int = Field(200, description="Overlap between chunks in characters")
    embedding_model: str = Field("all-MiniLM-L6-v2", description="Embedding model name")
    ignore_patterns: List[str] = Field([], description="File/folder ignore patterns")
    schedule: Optional[str] = Field(None, description="Cron schedule for auto re-indexing")
    enabled: bool = Field(True, description="Whether automatic processing is enabled")
    custom_settings: Dict[str, Any] = Field({}, description="Custom configuration settings")
    
    class Config:
        json_schema_extra = {
            "example": {
                "collection_name": "my_vault",
                "vault_path": "/Users/username/Documents/ObsidianVault",
                "chunk_size": 1200,
                "chunk_overlap": 150,
                "embedding_model": "all-MiniLM-L6-v2",
                "ignore_patterns": ["*.tmp", "drafts/*", ".obsidian/*"],
                "schedule": "0 2 * * *",
                "enabled": True,
                "custom_settings": {
                    "max_file_size_mb": 10,
                    "processing_timeout_seconds": 300
                }
            }
        }


class SearchResultItem(BaseModel):
    """Individual search result item."""
    
    document_id: str = Field(..., description="Document identifier")
    content: str = Field(..., description="Document content snippet")
    metadata: Dict[str, Any] = Field({}, description="Document metadata")
    similarity_score: float = Field(..., description="Similarity score (0-1)")
    file_path: str = Field(..., description="Relative file path in vault")
    chunk_index: Optional[int] = Field(None, description="Chunk index within document")
    
    class Config:
        json_schema_extra = {
            "example": {
                "document_id": "doc_123_chunk_0",
                "content": "Machine learning is a method of data analysis that automates analytical model building...",
                "metadata": {
                    "file_name": "machine-learning.md",
                    "folder": "research/ai",
                    "tags": ["AI", "ML", "algorithms"],
                    "created_at": "2024-01-10T09:00:00Z",
                    "modified_at": "2024-01-12T15:30:00Z",
                    "word_count": 1250,
                    "file_size": 5120
                },
                "similarity_score": 0.87,
                "file_path": "research/ai/machine-learning.md",
                "chunk_index": 0
            }
        }


class SearchResultsResponse(BaseModel):
    """Search results response."""
    
    query: str = Field(..., description="Original search query")
    results: List[SearchResultItem] = Field(..., description="Search results")
    total_results: int = Field(..., description="Total number of results found")
    search_time_ms: float = Field(..., description="Search execution time in milliseconds")
    collection_name: str = Field(..., description="Searched collection name")
    filters_applied: Dict[str, Any] = Field({}, description="Filters that were applied")
    
    class Config:
        json_schema_extra = {
            "example": {
                "query": "machine learning algorithms",
                "results": [
                    {
                        "document_id": "doc_123_chunk_0",
                        "content": "Machine learning is a method of data analysis...",
                        "similarity_score": 0.87,
                        "file_path": "research/ai/machine-learning.md"
                    }
                ],
                "total_results": 15,
                "search_time_ms": 5.3,
                "collection_name": "my_vault",
                "filters_applied": {}
            }
        }


class JobResponse(BaseModel):
    """Job operation response."""
    
    job_id: str = Field(..., description="Job identifier")
    job_type: str = Field(..., description="Type of job")
    collection_name: str = Field(..., description="Target collection")
    status: str = Field(..., description="Job status")
    created_at: datetime = Field(..., description="Job creation time")
    started_at: Optional[datetime] = Field(None, description="Job start time")
    completed_at: Optional[datetime] = Field(None, description="Job completion time")
    progress_data: Optional[Dict[str, Any]] = Field(None, description="Progress information")
    error_message: Optional[str] = Field(None, description="Error message if failed")
    estimated_duration: Optional[int] = Field(None, description="Estimated duration in seconds")
    
    class Config:
        json_schema_extra = {
            "example": {
                "job_id": "job_abc123def456",
                "job_type": "reindex_collection",
                "collection_name": "my_vault",
                "status": "running",
                "created_at": "2024-01-15T14:00:00Z",
                "started_at": "2024-01-15T14:00:05Z",
                "completed_at": None,
                "progress_data": {
                    "percentage": 45.0,
                    "files_processed": 112,
                    "total_files": 247
                },
                "error_message": None,
                "estimated_duration": 180
            }
        }


class CollectionStatsResponse(BaseModel):
    """Collection statistics response."""
    
    collection_name: str = Field(..., description="Collection identifier")
    document_count: int = Field(..., description="Total number of documents")
    chunk_count: int = Field(..., description="Total number of chunks")
    total_size_bytes: int = Field(..., description="Total size in bytes")
    avg_document_size: float = Field(..., description="Average document size in bytes")
    embedding_dimension: int = Field(..., description="Embedding vector dimension")
    last_updated: datetime = Field(..., description="Last update timestamp")
    file_type_distribution: Dict[str, int] = Field({}, description="Distribution by file type")
    folder_distribution: Dict[str, int] = Field({}, description="Distribution by folder")
    
    class Config:
        json_schema_extra = {
            "example": {
                "collection_name": "my_vault",
                "document_count": 247,
                "chunk_count": 1853,
                "total_size_bytes": 2097152,
                "avg_document_size": 8490.5,
                "embedding_dimension": 384,
                "last_updated": "2024-01-15T14:22:00Z",
                "file_type_distribution": {
                    ".md": 240,
                    ".txt": 7
                },
                "folder_distribution": {
                    "research": 89,
                    "projects": 67,
                    "notes": 91
                }
            }
        }


class BulkOperationResponse(BaseModel):
    """Bulk operation response."""
    
    operation: str = Field(..., description="Operation performed")
    total_collections: int = Field(..., description="Total collections processed")
    successful: List[str] = Field([], description="Successfully processed collections")
    failed: List[Dict[str, str]] = Field([], description="Failed collections with errors")
    job_ids: List[str] = Field([], description="Background job IDs if applicable")
    summary: Dict[str, Any] = Field({}, description="Operation summary")
    
    class Config:
        json_schema_extra = {
            "example": {
                "operation": "health_check",
                "total_collections": 3,
                "successful": ["vault_main", "vault_work"],
                "failed": [
                    {
                        "collection": "vault_broken",
                        "error": "ChromaDB collection not accessible"
                    }
                ],
                "job_ids": [],
                "summary": {
                    "healthy_collections": 2,
                    "unhealthy_collections": 1,
                    "total_documents": 1247
                }
            }
        }


class DeleteConfirmationResponse(BaseModel):
    """Collection deletion confirmation response."""
    
    collection_name: str = Field(..., description="Collection to delete")
    vault_path: str = Field(..., description="Vault path")
    document_count: int = Field(..., description="Number of documents to delete")
    size_estimate: int = Field(..., description="Estimated size in bytes")
    created_at: datetime = Field(..., description="Collection creation time")
    confirmation_token: str = Field(..., description="Token required for deletion")
    token_expires_in: int = Field(..., description="Token expiration time in seconds")
    warning: str = Field(..., description="Deletion warning message")
    
    class Config:
        json_schema_extra = {
            "example": {
                "collection_name": "old_vault",
                "vault_path": "/Users/username/Documents/OldVault",
                "document_count": 156,
                "size_estimate": 524288,
                "created_at": "2023-12-01T10:00:00Z",
                "confirmation_token": "abc123def456",
                "token_expires_in": 300,
                "warning": "This action cannot be undone. All indexed data will be permanently deleted."
            }
        }


class ExportResponse(BaseModel):
    """Collection export response."""
    
    export_id: str = Field(..., description="Export job identifier")
    collection_name: str = Field(..., description="Exported collection")
    format: str = Field(..., description="Export format")
    status: str = Field(..., description="Export status")
    download_url: Optional[str] = Field(None, description="Download URL when ready")
    file_size_bytes: Optional[int] = Field(None, description="Export file size")
    expires_at: Optional[datetime] = Field(None, description="Download expiration time")
    
    class Config:
        json_schema_extra = {
            "example": {
                "export_id": "export_xyz789",
                "collection_name": "my_vault",
                "format": "json",
                "status": "completed",
                "download_url": "/api/collections/my_vault/exports/export_xyz789/download",
                "file_size_bytes": 1048576,
                "expires_at": "2024-01-16T14:22:00Z"
            }
        }