"""
Response models for the Vault Mind API.
Defines consistent response structure across all endpoints.
"""
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class APIResponse(BaseModel):
    """Base response model for all API endpoints."""
    status: str = Field(..., description="Response status: 'success' or 'error'")
    data: Optional[Dict[str, Any]] = Field(default=None, description="Response payload")
    message: str = Field(..., description="Human-readable message")
    timestamp: float = Field(..., description="Unix timestamp of response")
    request_id: str = Field(..., description="Correlation ID for request tracking")


class ErrorDetail(BaseModel):
    """Error detail structure for error responses."""
    code: str = Field(..., description="Error code identifier")
    message: str = Field(..., description="Error message")
    details: Dict[str, Any] = Field(default_factory=dict, description="Additional error details")


class ErrorResponse(BaseModel):
    """Error response model."""
    status: str = Field(default="error", description="Always 'error' for error responses")
    error: ErrorDetail = Field(..., description="Error details")
    timestamp: float = Field(..., description="Unix timestamp of response")
    request_id: str = Field(..., description="Correlation ID for request tracking")


class HealthResponse(BaseModel):
    """Health check response model."""
    service_status: str = Field(..., description="Overall service health")
    database: Dict[str, Any] = Field(..., description="Database health status")
    embedding_service: Dict[str, Any] = Field(..., description="Embedding service health status")
    version: str = Field(..., description="API version")
    environment: str = Field(..., description="Runtime environment")


class IndexingJobResponse(BaseModel):
    """Response model for indexing job creation."""
    job_id: str = Field(..., description="Unique job identifier")
    status: str = Field(..., description="Job status: 'started' or 'queued'")
    estimated_duration: Optional[int] = Field(default=None, description="Estimated completion time in seconds")
    collection_name: str = Field(..., description="ChromaDB collection name")
    vault_name: str = Field(..., description="Vault name")
    total_files: Optional[int] = Field(default=None, description="Total files to process")


class SearchResult(BaseModel):
    """Individual search result model."""
    id: str = Field(..., description="Document/chunk ID")
    content: str = Field(..., description="Matching text content")
    similarity_score: float = Field(..., description="Cosine similarity score (0-1)")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Document metadata")
    context: Optional[Dict[str, str]] = Field(default=None, description="Surrounding context")


class SearchResponse(BaseModel):
    """Response model for search queries."""
    results: list[SearchResult] = Field(..., description="Search results")
    total_found: int = Field(..., description="Total matching documents")
    search_time_ms: float = Field(..., description="Query execution time in milliseconds")
    vault_info: Dict[str, Any] = Field(..., description="Vault metadata")


class VaultInfo(BaseModel):
    """Vault collection information model."""
    vault_name: str = Field(..., description="Vault name")
    collection_name: str = Field(..., description="ChromaDB collection name")
    document_count: int = Field(..., description="Number of indexed documents")
    vault_path: Optional[str] = Field(default=None, description="Filesystem path")
    description: Optional[str] = Field(default=None, description="Vault description")
    created_at: Optional[str] = Field(default=None, description="Creation timestamp")
    last_indexed: Optional[str] = Field(default=None, description="Last indexing timestamp")


class JobStatus(BaseModel):
    """Job status information model."""
    job_id: str = Field(..., description="Job identifier")
    vault_name: str = Field(..., description="Target vault name")
    status: str = Field(..., description="Job status")
    progress_percent: float = Field(..., description="Completion percentage (0-100)")
    files_processed: int = Field(..., description="Files processed so far")
    total_files: int = Field(..., description="Total files to process")
    started_at: str = Field(..., description="Job start timestamp")
    estimated_completion: Optional[str] = Field(default=None, description="Estimated completion time")
    error_message: Optional[str] = Field(default=None, description="Error message if failed")


class SystemHealth(BaseModel):
    """System health information model."""
    service_status: str = Field(..., description="Overall service health")
    uptime_seconds: float = Field(..., description="Service uptime in seconds")
    memory_usage_mb: float = Field(..., description="Memory usage in MB")
    cpu_usage_percent: float = Field(..., description="CPU usage percentage")


class DatabaseHealth(BaseModel):
    """Database health information model."""
    connected: bool = Field(..., description="Database connection status")
    response_time_ms: float = Field(..., description="Database response time")
    total_collections: int = Field(..., description="Total number of collections")
    total_documents: int = Field(..., description="Total number of documents")


class StatusResponse(BaseModel):
    """Response model for status endpoint."""
    system_status: SystemHealth = Field(..., description="System health information")
    vault_collections: list[VaultInfo] = Field(..., description="List of vault collections")
    active_jobs: list[JobStatus] = Field(..., description="Currently active jobs")
    database_health: DatabaseHealth = Field(..., description="Database health status")