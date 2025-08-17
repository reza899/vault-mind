"""
Request models for the Vault Mind API.
Defines input validation for all API endpoints.
"""
from typing import Optional
from pydantic import BaseModel, Field, validator
from pathlib import Path


class IndexVaultRequest(BaseModel):
    """Request model for vault indexing."""
    vault_name: str = Field(
        ..., 
        min_length=1, 
        max_length=100,
        description="Unique vault identifier (alphanumeric, underscores, hyphens only)"
    )
    vault_path: str = Field(
        ..., 
        min_length=1,
        description="Filesystem path to the Obsidian vault directory"
    )
    description: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Optional description of the vault"
    )
    schedule: Optional[str] = Field(
        default=None,
        description="Optional cron schedule for automatic re-indexing"
    )
    force_reindex: bool = Field(
        default=False,
        description="Force re-indexing even if vault already exists"
    )
    
    @validator('vault_name')
    def validate_vault_name(cls, v):
        """Validate vault name format."""
        if not v.replace('_', '').replace('-', '').isalnum():
            raise ValueError('Vault name can only contain alphanumeric characters, underscores, and hyphens')
        
        # Check for reserved names
        reserved_names = {'admin', 'api', 'system', 'health', 'status', 'docs'}
        if v.lower() in reserved_names:
            raise ValueError(f'Vault name "{v}" is reserved')
        
        return v
    
    @validator('vault_path')
    def validate_vault_path(cls, v):
        """Validate vault path exists and is accessible."""
        try:
            path = Path(v).resolve()
            if not path.exists():
                raise ValueError(f'Vault path does not exist: {v}')
            if not path.is_dir():
                raise ValueError(f'Vault path is not a directory: {v}')
            
            # Check for basic accessibility
            test_files = list(path.glob('*.md'))
            if not test_files and not any(path.rglob('*.md')):
                raise ValueError(f'No markdown files found in vault: {v}')
                
        except Exception as e:
            if isinstance(e, ValueError):
                raise
            raise ValueError(f'Invalid vault path: {v} - {str(e)}')
        
        return str(path)
    
    @validator('schedule')
    def validate_schedule(cls, v):
        """Validate cron schedule format."""
        if v is None:
            return v
        
        # Basic cron validation (can be enhanced)
        parts = v.split()
        if len(parts) != 5:
            raise ValueError('Schedule must be in cron format (5 space-separated fields)')
        
        return v


class SearchVaultRequest(BaseModel):
    """Request model for vault search."""
    vault_name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Name of the vault to search"
    )
    query: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        description="Search query text"
    )
    limit: int = Field(
        default=10,
        ge=1,
        le=100,
        description="Maximum number of results to return"
    )
    similarity_threshold: float = Field(
        default=0.7,
        ge=0.0,
        le=1.0,
        description="Minimum similarity score for results (0.0-1.0)"
    )
    include_context: bool = Field(
        default=True,
        description="Include surrounding context in results"
    )
    filter_metadata: Optional[dict] = Field(
        default=None,
        description="Optional metadata filters (e.g., file_type, tags)"
    )
    
    @validator('query')
    def validate_query(cls, v):
        """Validate search query."""
        # Remove excessive whitespace
        v = ' '.join(v.split())
        
        if len(v.strip()) == 0:
            raise ValueError('Query cannot be empty or whitespace only')
        
        return v


class StatusRequest(BaseModel):
    """Request model for status queries."""
    vault_name: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Optional vault name to get specific status"
    )
    job_id: Optional[str] = Field(
        default=None,
        description="Optional job ID to get specific job status"
    )
    include_metrics: bool = Field(
        default=True,
        description="Include performance metrics in response"
    )
    
    @validator('vault_name')
    def validate_vault_name(cls, v):
        """Validate vault name if provided."""
        if v is not None and len(v.strip()) == 0:
            raise ValueError('Vault name cannot be empty if provided')
        return v


class WebSocketMessage(BaseModel):
    """Base model for WebSocket messages."""
    type: str = Field(..., description="Message type")
    data: dict = Field(..., description="Message payload")
    timestamp: float = Field(..., description="Message timestamp")


class IndexingProgressMessage(WebSocketMessage):
    """WebSocket message for indexing progress updates."""
    type: str = Field(default="indexing_progress", description="Message type")
    job_id: str = Field(..., description="Job identifier")
    vault_name: str = Field(..., description="Vault being indexed")
    files_processed: int = Field(..., description="Files processed so far")
    total_files: int = Field(..., description="Total files to process")
    current_file: Optional[str] = Field(default=None, description="Currently processing file")
    progress_percent: float = Field(..., description="Completion percentage")
    processing_rate: Optional[float] = Field(default=None, description="Files per second")


class IndexingStatusMessage(WebSocketMessage):
    """WebSocket message for indexing status changes."""
    type: str = Field(..., description="Message type: started, completed, error")
    job_id: str = Field(..., description="Job identifier")
    vault_name: str = Field(..., description="Vault name")
    status: str = Field(..., description="New status")
    message: str = Field(..., description="Status message")
    error_details: Optional[dict] = Field(default=None, description="Error details if applicable")