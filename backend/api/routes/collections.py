"""
Collection management routes for the Vault Mind API.
Handles multi-collection operations and vault management.
"""
import logging
import time
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Request, status, Depends
from pydantic import ValidationError

from api.models.collection_requests import (
    CreateCollectionRequest,
    UpdateCollectionConfigRequest,
    SearchCollectionRequest,
    ReindexCollectionRequest
)
from api.models.responses import APIResponse
from services.collection_manager import CollectionManager
from api.dependencies import get_collection_manager

logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/collections", tags=["Collections"])


@router.get("", response_model=APIResponse)
async def list_collections(
    req: Request,
    page: int = 1,
    limit: int = 50,
    collection_manager: CollectionManager = Depends(get_collection_manager)
) -> Dict[str, Any]:
    """
    List all collections with metadata and pagination support.
    
    **Query Parameters:**
    - `page`: Page number (default: 1)
    - `limit`: Items per page (default: 50, max: 100)
    
    **Response:**
    - `collections`: List of collections with metadata
    - `pagination`: Page info (current, total, has_next, has_previous)
    
    **Collection Metadata:**
    - collection_name, document_count, last_indexed, status, size_bytes
    - Health indicators (healthy/indexing/error/empty)
    """
    correlation_id = getattr(req.state, 'correlation_id', 'unknown')
    start_time = time.time()
    
    try:
        # Smart logging: Skip verbose logs for polling requests (reduce noise)
        is_polling = page == 1 and limit == 50  # Standard polling parameters
        
        if not is_polling:
            logger.info(f"Listing collections - page {page}, limit {limit} [{correlation_id}]")
        
        # Validate pagination parameters
        if limit > 100:
            limit = 100
        if page < 1:
            page = 1
            
        # Get collections with metadata
        result = await collection_manager.list_collections(page=page, limit=limit)
        
        processing_time = time.time() - start_time
        if not is_polling:
            logger.info(
                f"Listed {len(result['collections'])} collections - "
                f"Time: {processing_time:.3f}s [{correlation_id}]"
            )
        
        return {
            "status": "success",
            "data": result,
            "message": f"Retrieved {len(result['collections'])} collections",
            "timestamp": time.time(),
            "request_id": correlation_id
        }
        
    except Exception as e:
        processing_time = time.time() - start_time
        logger.error(
            f"Error listing collections: {str(e)} "
            f"Time: {processing_time:.3f}s [{correlation_id}]",
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error retrieving collections"
        )


@router.post("", response_model=APIResponse)
async def create_collection(
    request: CreateCollectionRequest,
    req: Request,
    collection_manager: CollectionManager = Depends(get_collection_manager)
) -> Dict[str, Any]:
    """
    Create a new collection from an Obsidian vault.
    
    **Request Body:**
    - `collection_name`: Unique identifier for the collection
    - `vault_path`: Path to the Obsidian vault directory
    - `description`: Optional description
    - `config`: Optional configuration overrides
    
    **Response:**
    - `collection_id`: Created collection identifier
    - `status`: Initial status
    - `estimated_indexing_time`: Estimated completion time in seconds
    
    **Error Cases:**
    - 400: Invalid request parameters or vault path
    - 409: Collection name already exists
    - 404: Vault path not found or missing .obsidian folder
    """
    correlation_id = getattr(req.state, 'correlation_id', 'unknown')
    start_time = time.time()
    
    try:
        logger.info(f"Creating collection '{request.collection_name}' [{correlation_id}]")
        
        # Create collection and start indexing
        result = await collection_manager.create_collection(
            collection_name=request.collection_name,
            vault_path=request.vault_path,
            description=request.description,
            config=request.config
        )
        
        processing_time = time.time() - start_time
        logger.info(
            f"Collection '{request.collection_name}' created - "
            f"Time: {processing_time:.3f}s [{correlation_id}]"
        )
        
        return {
            "status": "success",
            "data": result,
            "message": f"Collection '{request.collection_name}' created successfully",
            "timestamp": time.time(),
            "request_id": correlation_id
        }
        
    except ValidationError as e:
        logger.warning(f"Validation error creating collection: {e} [{correlation_id}]")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Validation error: {str(e)}"
        )
        
    except ValueError as e:
        error_msg = str(e)
        
        if "already exists" in error_msg:
            logger.warning(f"Collection already exists: {request.collection_name} [{correlation_id}]")
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Collection '{request.collection_name}' already exists"
            )
        elif "does not exist" in error_msg or "not found" in error_msg:
            logger.warning(f"Vault path not found: {request.vault_path} [{correlation_id}]")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Vault path not found or missing .obsidian folder: {request.vault_path}"
            )
        elif "No markdown files" in error_msg:
            logger.warning(f"No markdown files in vault: {request.vault_path} [{correlation_id}]")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No markdown files found in vault directory: {request.vault_path}"
            )
        else:
            logger.error(f"Collection creation error: {error_msg} [{correlation_id}]")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid request: {error_msg}"
            )
            
    except Exception as e:
        processing_time = time.time() - start_time
        logger.error(
            f"Unexpected error creating collection: {str(e)} "
            f"Time: {processing_time:.3f}s [{correlation_id}]",
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during collection creation"
        )


@router.delete("/{collection_name}", response_model=APIResponse)
async def delete_collection(
    collection_name: str,
    req: Request,
    confirmation_token: Optional[str] = None,
    collection_manager: CollectionManager = Depends(get_collection_manager)
) -> Dict[str, Any]:
    """
    Delete a collection with soft delete and confirmation.
    
    **Path Parameters:**
    - `collection_name`: Collection to delete
    
    **Query Parameters:**
    - `confirmation_token`: Required for actual deletion (optional for confirmation request)
    
    **Response:**
    - If no token: Returns confirmation token and deletion details
    - If valid token: Confirms deletion and returns cleanup job ID
    
    **Error Cases:**
    - 404: Collection not found
    - 400: Invalid confirmation token
    """
    correlation_id = getattr(req.state, 'correlation_id', 'unknown')
    start_time = time.time()
    
    try:
        logger.info(f"Delete request for collection '{collection_name}' [{correlation_id}]")
        
        if not confirmation_token:
            # Return confirmation details
            confirmation_info = await collection_manager.get_deletion_confirmation(collection_name)
            
            return {
                "status": "confirmation_required",
                "data": confirmation_info,
                "message": f"Confirm deletion of collection '{collection_name}'",
                "timestamp": time.time(),
                "request_id": correlation_id
            }
        
        # Execute deletion
        result = await collection_manager.delete_collection(collection_name, confirmation_token)
        
        processing_time = time.time() - start_time
        logger.info(
            f"Collection '{collection_name}' deleted - "
            f"Time: {processing_time:.3f}s [{correlation_id}]"
        )
        
        return {
            "status": "success",
            "data": result,
            "message": f"Collection '{collection_name}' deleted successfully",
            "timestamp": time.time(),
            "request_id": correlation_id
        }
        
    except ValueError as e:
        error_msg = str(e)
        if "not found" in error_msg:
            logger.warning(f"Collection not found for deletion: {collection_name} [{correlation_id}]")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Collection '{collection_name}' not found"
            )
        elif "invalid token" in error_msg or "expired" in error_msg:
            logger.warning(f"Invalid deletion token: {collection_name} [{correlation_id}]")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired confirmation token"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
            
    except Exception as e:
        processing_time = time.time() - start_time
        logger.error(
            f"Error deleting collection {collection_name}: {str(e)} "
            f"Time: {processing_time:.3f}s [{correlation_id}]",
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during deletion"
        )


@router.get("/{collection_name}/status", response_model=APIResponse)
async def get_collection_status(
    collection_name: str,
    req: Request,
    collection_manager: CollectionManager = Depends(get_collection_manager)
) -> Dict[str, Any]:
    """
    Get detailed status for a specific collection.
    
    **Path Parameters:**
    - `collection_name`: Collection to query
    
    **Response:**
    - indexing_progress, file_counts, error_logs, performance_metrics
    - Real-time status for active indexing operations
    
    **Error Cases:**
    - 404: Collection not found
    """
    correlation_id = getattr(req.state, 'correlation_id', 'unknown')
    
    try:
        logger.info(f"Getting status for collection '{collection_name}' [{correlation_id}]")
        
        status_info = await collection_manager.get_collection_status(collection_name)
        
        if not status_info:
            logger.warning(f"Collection not found: {collection_name} [{correlation_id}]")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Collection '{collection_name}' not found"
            )
        
        return {
            "status": "success",
            "data": status_info,
            "message": f"Status retrieved for collection '{collection_name}'",
            "timestamp": time.time(),
            "request_id": correlation_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting collection status {collection_name}: {str(e)} [{correlation_id}]", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error retrieving collection status"
        )


@router.post("/{collection_name}/reindex", response_model=APIResponse)
async def reindex_collection(
    collection_name: str,
    request: ReindexCollectionRequest,
    req: Request,
    collection_manager: CollectionManager = Depends(get_collection_manager)
) -> Dict[str, Any]:
    """
    Trigger re-indexing for a collection.
    
    **Path Parameters:**
    - `collection_name`: Collection to re-index
    
    **Request Body:**
    - `mode`: 'full' (default: full)
    - `force`: Force re-indexing even if already running
    
    **Response:**
    - `job_id`: Background job identifier for tracking
    - Queue management for concurrent operations (max 3)
    
    **Error Cases:**
    - 404: Collection not found
    - 409: Indexing already in progress (unless force=true)
    - 503: Job queue full (too many concurrent operations)
    """
    correlation_id = getattr(req.state, 'correlation_id', 'unknown')
    start_time = time.time()
    
    try:
        logger.info(f"Reindexing collection '{collection_name}' [{correlation_id}]")
        
        result = await collection_manager.reindex_collection(
            collection_name=collection_name,
            mode=request.mode,
            force=request.force
        )
        
        processing_time = time.time() - start_time
        logger.info(
            f"Reindexing started for '{collection_name}' - "
            f"Job: {result['job_id']} Time: {processing_time:.3f}s [{correlation_id}]"
        )
        
        return {
            "status": "success",
            "data": result,
            "message": f"Re-indexing started for collection '{collection_name}'",
            "timestamp": time.time(),
            "request_id": correlation_id
        }
        
    except ValueError as e:
        error_msg = str(e)
        if "not found" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Collection '{collection_name}' not found"
            )
        elif "already running" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Indexing already in progress for '{collection_name}'. Use force=true to override."
            )
        elif "queue full" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Job queue is full. Please try again later."
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
            
    except Exception as e:
        processing_time = time.time() - start_time
        logger.error(
            f"Error reindexing collection {collection_name}: {str(e)} "
            f"Time: {processing_time:.3f}s [{correlation_id}]",
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during re-indexing"
        )


@router.post("/{collection_name}/pause", response_model=APIResponse)
async def pause_indexing(
    collection_name: str,
    req: Request,
    collection_manager: CollectionManager = Depends(get_collection_manager)
) -> Dict[str, Any]:
    """
    Pause active indexing for a collection.
    
    **Path Parameters:**
    - `collection_name`: Collection to pause
    
    **Response:**
    - Graceful pause with state persistence and resume capability
    
    **Error Cases:**
    - 404: Collection not found
    - 400: No active indexing to pause
    """
    correlation_id = getattr(req.state, 'correlation_id', 'unknown')
    
    try:
        logger.info(f"Pausing indexing for collection '{collection_name}' [{correlation_id}]")
        
        result = await collection_manager.pause_indexing(collection_name)
        
        return {
            "status": "success",
            "data": result,
            "message": f"Indexing paused for collection '{collection_name}'",
            "timestamp": time.time(),
            "request_id": correlation_id
        }
        
    except ValueError as e:
        error_msg = str(e)
        if "not found" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Collection '{collection_name}' not found"
            )
        elif "no active" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No active indexing to pause for collection '{collection_name}'"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
            
    except Exception as e:
        logger.error(f"Error pausing indexing {collection_name}: {str(e)} [{correlation_id}]", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error pausing indexing"
        )


@router.get("/{collection_name}/health", response_model=APIResponse)
async def get_collection_health(
    collection_name: str,
    req: Request,
    collection_manager: CollectionManager = Depends(get_collection_manager)
) -> Dict[str, Any]:
    """
    Health check for a collection.
    
    **Path Parameters:**
    - `collection_name`: Collection to check
    
    **Response:**
    - Validates ChromaDB connection, file accessibility, configuration
    - Returns actionable error messages for issues
    
    **Error Cases:**
    - 404: Collection not found
    """
    correlation_id = getattr(req.state, 'correlation_id', 'unknown')
    
    try:
        logger.info(f"Health check for collection '{collection_name}' [{correlation_id}]")
        
        health_info = await collection_manager.get_collection_health(collection_name)
        
        if not health_info:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Collection '{collection_name}' not found"
            )
        
        return {
            "status": "success",
            "data": health_info,
            "message": f"Health check completed for collection '{collection_name}'",
            "timestamp": time.time(),
            "request_id": correlation_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking collection health {collection_name}: {str(e)} [{correlation_id}]", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during health check"
        )


@router.get("/{collection_name}/config", response_model=APIResponse)
async def get_collection_config(
    collection_name: str,
    req: Request,
    collection_manager: CollectionManager = Depends(get_collection_manager)
) -> Dict[str, Any]:
    """
    Get collection configuration settings.
    
    **Path Parameters:**
    - `collection_name`: Collection to query
    
    **Response:**
    - vault_path, chunk_size, embedding_model, schedules, ignore_patterns
    
    **Error Cases:**
    - 404: Collection not found
    """
    correlation_id = getattr(req.state, 'correlation_id', 'unknown')
    
    try:
        logger.info(f"Getting config for collection '{collection_name}' [{correlation_id}]")
        
        config = await collection_manager.get_collection_config(collection_name)
        
        if not config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Collection '{collection_name}' not found"
            )
        
        return {
            "status": "success",
            "data": config,
            "message": f"Configuration retrieved for collection '{collection_name}'",
            "timestamp": time.time(),
            "request_id": correlation_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting collection config {collection_name}: {str(e)} [{correlation_id}]", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error retrieving configuration"
        )


@router.put("/{collection_name}/config", response_model=APIResponse)
async def update_collection_config(
    collection_name: str,
    request: UpdateCollectionConfigRequest,
    req: Request,
    collection_manager: CollectionManager = Depends(get_collection_manager)
) -> Dict[str, Any]:
    """
    Update collection configuration settings.
    
    **Path Parameters:**
    - `collection_name`: Collection to update
    
    **Request Body:**
    - Configuration fields to update (chunk_size, embedding_model, etc.)
    
    **Response:**
    - Updated configuration and any triggered operations (like re-indexing)
    
    **Error Cases:**
    - 404: Collection not found
    - 400: Invalid configuration values
    """
    correlation_id = getattr(req.state, 'correlation_id', 'unknown')
    start_time = time.time()
    
    try:
        logger.info(f"Updating config for collection '{collection_name}' [{correlation_id}]")
        
        result = await collection_manager.update_collection_config(
            collection_name=collection_name,
            config_updates=request.dict(exclude_unset=True)
        )
        
        processing_time = time.time() - start_time
        logger.info(
            f"Config updated for '{collection_name}' - "
            f"Time: {processing_time:.3f}s [{correlation_id}]"
        )
        
        return {
            "status": "success",
            "data": result,
            "message": f"Configuration updated for collection '{collection_name}'",
            "timestamp": time.time(),
            "request_id": correlation_id
        }
        
    except ValueError as e:
        error_msg = str(e)
        if "not found" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Collection '{collection_name}' not found"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
            
    except Exception as e:
        processing_time = time.time() - start_time
        logger.error(
            f"Error updating collection config {collection_name}: {str(e)} "
            f"Time: {processing_time:.3f}s [{correlation_id}]",
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error updating configuration"
        )


@router.post("/{collection_name}/search", response_model=APIResponse)
async def search_collection(
    collection_name: str,
    request: SearchCollectionRequest,
    req: Request,
    collection_manager: CollectionManager = Depends(get_collection_manager)
) -> Dict[str, Any]:
    """
    Search within a specific collection.
    
    **Path Parameters:**
    - `collection_name`: Collection to search
    
    **Request Body:**
    - `query`: Search query text
    - `filters`: Optional filters (tags, dates, folders)
    - `limit`: Number of results (default: 10, max: 100)
    - `similarity_threshold`: Minimum similarity score (default: 0.4)
    
    **Response:**
    - Enhanced search results with collection isolation
    - Maintains <10ms response time target
    
    **Error Cases:**
    - 404: Collection not found
    - 400: Invalid search parameters
    """
    correlation_id = getattr(req.state, 'correlation_id', 'unknown')
    start_time = time.time()
    
    try:
        logger.info(f"Searching collection '{collection_name}' [{correlation_id}]")
        
        results = await collection_manager.search_collection(
            collection_name=collection_name,
            query=request.query,
            filters=request.filters,
            limit=request.limit,
            similarity_threshold=request.similarity_threshold
        )
        
        processing_time = time.time() - start_time
        logger.info(
            f"Search completed for '{collection_name}' - "
            f"{len(results['results'])} results in {processing_time*1000:.1f}ms [{correlation_id}]"
        )
        
        # Check performance target
        if processing_time > 0.01:  # 10ms
            logger.warning(f"Search exceeded 10ms target: {processing_time*1000:.1f}ms [{correlation_id}]")
        
        return {
            "status": "success",
            "data": results,
            "message": f"Found {len(results['results'])} results in collection '{collection_name}'",
            "timestamp": time.time(),
            "request_id": correlation_id
        }
        
    except ValueError as e:
        error_msg = str(e)
        if "not found" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Collection '{collection_name}' not found"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
            
    except Exception as e:
        processing_time = time.time() - start_time
        logger.error(
            f"Error searching collection {collection_name}: {str(e)} "
            f"Time: {processing_time:.3f}s [{correlation_id}]",
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during search"
        )