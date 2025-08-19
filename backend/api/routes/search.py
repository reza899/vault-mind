"""
Search routes for the Vault Mind API.
Handles semantic search operations across indexed vaults.
"""
import logging
import time
from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Request, status, Depends, Query
from pydantic import ValidationError

from api.models.requests import SearchVaultRequest
from api.models.responses import APIResponse, SearchResponse
from services.vault_service import VaultService
from api.dependencies import get_vault_service

logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/search", tags=["Search"])


@router.get("", response_model=APIResponse)
async def search_vault(
    req: Request,
    vault_service: VaultService = Depends(get_vault_service),
    vault_name: str = Query(..., description="Name of the vault to search"),
    query: str = Query(..., min_length=1, max_length=1000, description="Search query text"),
    limit: int = Query(default=10, ge=1, le=100, description="Maximum number of results"),
    similarity_threshold: float = Query(default=0.7, ge=0.0, le=1.0, description="Minimum similarity score"),
    include_context: bool = Query(default=True, description="Include surrounding context in results"),
    include_tags: str = Query(default=None, description="Comma-separated list of tags to include"),
    exclude_tags: str = Query(default=None, description="Comma-separated list of tags to exclude")
) -> Dict[str, Any]:
    """
    Perform semantic search across an indexed vault.
    
    Uses embedding-based similarity search to find relevant content across all documents
    in the specified vault. Results are ranked by semantic similarity score.
    
    **Query Parameters:**
    - `vault_name`: Name of the vault to search (must be already indexed)
    - `query`: Search query text (1-1000 characters)
    - `limit`: Maximum number of results to return (1-100, default: 10)
    - `similarity_threshold`: Minimum similarity score for results (0.0-1.0, default: 0.7)
    - `include_context`: Include surrounding text context in results (default: true)
    
    **Response:**
    - `results`: Array of search results with content, similarity scores, and metadata
    - `total_found`: Number of results matching the threshold
    - `search_time_ms`: Query execution time in milliseconds
    - `vault_info`: Information about the searched vault
    
    **Result Format:**
    Each result contains:
    - `id`: Unique document/chunk identifier
    - `content`: Matching text content
    - `similarity_score`: Cosine similarity score (0-1, higher = more similar)
    - `metadata`: Document metadata (file path, chunk info, etc.)
    - `context`: Surrounding text context (if include_context=true)
    
    **Error Cases:**
    - 400: Invalid query parameters
    - 404: Vault not found or not indexed
    - 500: Internal search error
    
    **Performance:**
    - Target response time: <500ms for 10k documents
    - Results sorted by similarity score (highest first)
    - Automatic query optimization for best performance
    """
    correlation_id = getattr(req.state, 'correlation_id', 'unknown')
    start_time = time.time()
    
    try:
        logger.info(f"Search request - Vault: {vault_name}, Query: '{query[:50]}...' [{correlation_id}]")
        
        # Validate vault name
        if not vault_name or len(vault_name.strip()) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Vault name cannot be empty"
            )
        
        # Validate query
        query = query.strip()
        if not query:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Search query cannot be empty"
            )
        
        # Prepare tag filters
        tag_filters = {}
        if include_tags:
            tag_filters['include_tags'] = [tag.strip() for tag in include_tags.split(',') if tag.strip()]
        if exclude_tags:
            tag_filters['exclude_tags'] = [tag.strip() for tag in exclude_tags.split(',') if tag.strip()]
        
        # Perform search
        search_results = await vault_service.search_vault(
            vault_name=vault_name,
            query=query,
            limit=limit,
            similarity_threshold=similarity_threshold,
            include_context=include_context,
            tag_filters=tag_filters if tag_filters else None
        )
        
        processing_time = time.time() - start_time
        logger.info(
            f"Search completed - Found: {search_results['total_found']} results "
            f"Time: {processing_time*1000:.1f}ms [{correlation_id}]"
        )
        
        # Prepare response
        response_data = SearchResponse(
            results=search_results['results'],
            total_found=search_results['total_found'],
            search_time_ms=search_results['search_time_ms'],
            vault_info=search_results['vault_info']
        )
        
        return {
            "status": "success",
            "data": response_data.dict(),
            "message": f"Found {search_results['total_found']} results for query '{query[:50]}{'...' if len(query) > 50 else ''}'",
            "timestamp": time.time(),
            "request_id": correlation_id
        }
        
    except ValidationError as e:
        logger.warning(f"Search validation error: {e} [{correlation_id}]")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Validation error: {str(e)}"
        )
        
    except ValueError as e:
        error_msg = str(e)
        
        # Handle specific error cases
        if "not found" in error_msg.lower() or "does not exist" in error_msg.lower():
            logger.warning(f"Vault not found: {vault_name} [{correlation_id}]")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Vault '{vault_name}' not found. Make sure the vault has been indexed first."
            )
        else:
            logger.error(f"Search validation error: {error_msg} [{correlation_id}]")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Search error: {error_msg}"
            )
            
    except Exception as e:
        processing_time = time.time() - start_time
        logger.error(
            f"Unexpected error in search: {str(e)} "
            f"Time: {processing_time:.3f}s [{correlation_id}]",
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during search operation"
        )


@router.post("", response_model=APIResponse)
async def search_vault_with_body(
    request: SearchVaultRequest,
    req: Request,
    vault_service: VaultService = Depends(get_vault_service)
) -> Dict[str, Any]:
    """
    Perform semantic search with request body (alternative to query parameters).
    
    Provides the same search functionality as GET /search but accepts parameters
    in the request body for more complex queries and better parameter handling.
    
    **Request Body:**
    - `vault_name`: Name of the vault to search
    - `query`: Search query text
    - `limit`: Maximum number of results (default: 10)
    - `similarity_threshold`: Minimum similarity score (default: 0.7)
    - `include_context`: Include surrounding context (default: true)
    - `filter_metadata`: Optional metadata filters
    
    **Use Cases:**
    - Complex queries with special characters
    - Queries longer than URL length limits
    - Programmatic API usage
    - Advanced filtering requirements
    
    All other behavior is identical to GET /search.
    """
    correlation_id = getattr(req.state, 'correlation_id', 'unknown')
    start_time = time.time()
    
    try:
        logger.info(f"Search POST request - Vault: {request.vault_name}, Query: '{request.query[:50]}...' [{correlation_id}]")
        
        # Extract tag filters from metadata if provided
        tag_filters = None
        if request.filter_metadata and 'tags' in request.filter_metadata:
            tag_data = request.filter_metadata['tags']
            tag_filters = {}
            if 'include' in tag_data:
                tag_filters['include_tags'] = tag_data['include']
            if 'exclude' in tag_data:
                tag_filters['exclude_tags'] = tag_data['exclude']
        
        # Perform search using the service
        search_results = await vault_service.search_vault(
            vault_name=request.vault_name,
            query=request.query,
            limit=request.limit,
            similarity_threshold=request.similarity_threshold,
            include_context=request.include_context,
            tag_filters=tag_filters
        )
        
        processing_time = time.time() - start_time
        logger.info(
            f"Search POST completed - Found: {search_results['total_found']} results "
            f"Time: {processing_time*1000:.1f}ms [{correlation_id}]"
        )
        
        # Prepare response
        response_data = SearchResponse(
            results=search_results['results'],
            total_found=search_results['total_found'],
            search_time_ms=search_results['search_time_ms'],
            vault_info=search_results['vault_info']
        )
        
        return {
            "status": "success",
            "data": response_data.dict(),
            "message": f"Found {search_results['total_found']} results for query '{request.query[:50]}{'...' if len(request.query) > 50 else ''}'",
            "timestamp": time.time(),
            "request_id": correlation_id
        }
        
    except ValidationError as e:
        logger.warning(f"Search POST validation error: {e} [{correlation_id}]")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Validation error: {str(e)}"
        )
        
    except ValueError as e:
        error_msg = str(e)
        
        if "not found" in error_msg.lower() or "does not exist" in error_msg.lower():
            logger.warning(f"Vault not found: {request.vault_name} [{correlation_id}]")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Vault '{request.vault_name}' not found. Make sure the vault has been indexed first."
            )
        else:
            logger.error(f"Search POST validation error: {error_msg} [{correlation_id}]")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Search error: {error_msg}"
            )
            
    except Exception as e:
        processing_time = time.time() - start_time
        logger.error(
            f"Unexpected error in search POST: {str(e)} "
            f"Time: {processing_time:.3f}s [{correlation_id}]",
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during search operation"
        )


@router.get("/collections", response_model=APIResponse)
async def list_searchable_vaults(
    req: Request,
    vault_service: VaultService = Depends(get_vault_service)
) -> Dict[str, Any]:
    """
    List all available vault collections that can be searched.
    
    Returns information about all indexed vaults including document counts,
    indexing dates, and collection metadata.
    
    **Response:**
    - Array of vault collection information
    - Document counts for each vault
    - Last indexing timestamps
    - Vault metadata and descriptions
    
    **Use Cases:**
    - Frontend vault selection UI
    - Admin dashboard overview
    - API discovery and exploration
    - System monitoring and status
    """
    correlation_id = getattr(req.state, 'correlation_id', 'unknown')
    
    try:
        logger.info(f"Listing searchable vaults [{correlation_id}]")
        
        vault_collections = await vault_service.get_vault_collections()
        
        return {
            "status": "success",
            "data": {
                "collections": vault_collections,
                "total_collections": len(vault_collections),
                "total_documents": sum(vault.get('document_count', 0) for vault in vault_collections)
            },
            "message": f"Found {len(vault_collections)} searchable vault collections",
            "timestamp": time.time(),
            "request_id": correlation_id
        }
        
    except Exception as e:
        logger.error(f"Error listing vault collections: {str(e)} [{correlation_id}]", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error retrieving vault collections"
        )


@router.get("/tags/{vault_name}", response_model=APIResponse)
async def get_vault_tags(
    vault_name: str,
    req: Request,
    vault_service: VaultService = Depends(get_vault_service),
    limit: int = Query(default=100, ge=1, le=500, description="Maximum number of tags to return")
) -> Dict[str, Any]:
    """
    Get all available tags from a specific vault.
    
    Returns a list of all tags found in the vault's documents, including both
    content tags (hashtags) and frontmatter tags, with usage frequency.
    
    **Path Parameters:**
    - `vault_name`: Name of the vault to get tags from
    
    **Query Parameters:**
    - `limit`: Maximum number of tags to return (1-500, default: 100)
    
    **Response:**
    - `tags`: Array of tag objects with name and frequency
    - `total_tags`: Total number of unique tags found
    - `vault_name`: Name of the searched vault
    
    **Tag Format:**
    Each tag contains:
    - `name`: Tag name/text
    - `frequency`: Number of documents containing this tag
    - `type`: Tag source ('content' for hashtags, 'frontmatter' for YAML tags)
    
    **Use Cases:**
    - Frontend tag selector/autocomplete
    - Tag-based filtering UI
    - Vault content analysis
    - Tag popularity metrics
    """
    correlation_id = getattr(req.state, 'correlation_id', 'unknown')
    
    try:
        logger.info(f"Getting tags for vault: {vault_name} [{correlation_id}]")
        
        # Get tags from vault service
        vault_tags = await vault_service.get_vault_tags(vault_name, limit)
        
        return {
            "status": "success",
            "data": {
                "tags": vault_tags["tags"],
                "total_tags": vault_tags["total_tags"],
                "vault_name": vault_name
            },
            "message": f"Found {vault_tags['total_tags']} tags in vault '{vault_name}'",
            "timestamp": time.time(),
            "request_id": correlation_id
        }
        
    except ValueError as e:
        error_msg = str(e)
        
        if "not found" in error_msg.lower() or "does not exist" in error_msg.lower():
            logger.warning(f"Vault not found: {vault_name} [{correlation_id}]")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Vault '{vault_name}' not found"
            )
        else:
            logger.error(f"Error getting vault tags: {error_msg} [{correlation_id}]")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error retrieving tags: {error_msg}"
            )
            
    except Exception as e:
        logger.error(f"Unexpected error getting vault tags: {str(e)} [{correlation_id}]", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error retrieving vault tags"
        )