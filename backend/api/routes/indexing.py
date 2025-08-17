"""
Indexing routes for the Vault Mind API.
Handles vault indexing operations and job management.
"""
import logging
import time
from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Request, status, Depends
from pydantic import ValidationError

from api.models.requests import IndexVaultRequest
from api.models.responses import APIResponse, IndexingJobResponse
from services.vault_service import VaultService
from api.dependencies import get_vault_service

logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/index", tags=["Indexing"])


# Vault service dependency is imported from api.dependencies


@router.post("", response_model=APIResponse)
async def index_vault(
    request: IndexVaultRequest,
    req: Request,
    vault_service: VaultService = Depends(get_vault_service)
) -> Dict[str, Any]:
    """
    Start vault indexing operation.
    
    Creates a background job to index an Obsidian vault into ChromaDB for semantic search.
    
    **Request Body:**
    - `vault_name`: Unique identifier for the vault (alphanumeric, underscores, hyphens only)
    - `vault_path`: Filesystem path to the Obsidian vault directory
    - `description`: Optional description of the vault
    - `schedule`: Optional cron schedule for automatic re-indexing
    - `force_reindex`: Force re-indexing even if vault already exists
    
    **Response:**
    - `job_id`: Unique identifier for tracking indexing progress
    - `status`: Job status ("started" or "queued")
    - `estimated_duration`: Estimated completion time in seconds
    - `collection_name`: ChromaDB collection name
    - `vault_name`: Vault identifier
    - `total_files`: Number of markdown files found (if available)
    
    **Error Cases:**
    - 400: Invalid request parameters
    - 409: Vault already exists (use force_reindex=true to overwrite)
    - 404: Vault path not found or inaccessible
    - 500: Internal server error during indexing setup
    """
    correlation_id = getattr(req.state, 'correlation_id', 'unknown')
    start_time = time.time()
    
    try:
        logger.info(f"Starting vault indexing request - {request.vault_name} [{correlation_id}]")
        
        # Start indexing operation
        job_id = await vault_service.index_vault(
            vault_name=request.vault_name,
            vault_path=request.vault_path,
            description=request.description,
            force_reindex=request.force_reindex
        )
        
        # Get initial job status for response
        job_status = await vault_service.get_job_status(job_id)
        if not job_status:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create indexing job"
            )
        
        # Prepare response data
        response_data = IndexingJobResponse(
            job_id=job_id,
            status=job_status["status"],
            estimated_duration=None,  # Will be calculated as job progresses
            collection_name=f"vault_{request.vault_name.lower().replace(' ', '_')}",
            vault_name=request.vault_name,
            total_files=job_status.get("total_files")
        )
        
        processing_time = time.time() - start_time
        logger.info(
            f"Vault indexing started successfully - Job: {job_id} "
            f"Time: {processing_time:.3f}s [{correlation_id}]"
        )
        
        return {
            "status": "success",
            "data": response_data.dict(),
            "message": f"Indexing started for vault '{request.vault_name}'. Use job_id '{job_id}' to track progress.",
            "timestamp": time.time(),
            "request_id": correlation_id
        }
        
    except ValidationError as e:
        logger.warning(f"Validation error in indexing request: {e} [{correlation_id}]")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Validation error: {str(e)}"
        )
        
    except ValueError as e:
        error_msg = str(e)
        
        # Handle specific error cases
        if "already exists" in error_msg:
            logger.warning(f"Vault already exists: {request.vault_name} [{correlation_id}]")
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Vault '{request.vault_name}' already exists. Use force_reindex=true to overwrite."
            )
        elif "does not exist" in error_msg or "not found" in error_msg:
            logger.warning(f"Vault path not found: {request.vault_path} [{correlation_id}]")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Vault path not found or inaccessible: {request.vault_path}"
            )
        elif "No markdown files" in error_msg:
            logger.warning(f"No markdown files in vault: {request.vault_path} [{correlation_id}]")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No markdown files found in vault directory: {request.vault_path}"
            )
        else:
            logger.error(f"Vault validation error: {error_msg} [{correlation_id}]")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid request: {error_msg}"
            )
            
    except Exception as e:
        processing_time = time.time() - start_time
        logger.error(
            f"Unexpected error in vault indexing: {str(e)} "
            f"Time: {processing_time:.3f}s [{correlation_id}]",
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during indexing setup"
        )


@router.get("/job/{job_id}", response_model=APIResponse)
async def get_indexing_job_status(
    job_id: str,
    req: Request,
    vault_service: VaultService = Depends(get_vault_service)
) -> Dict[str, Any]:
    """
    Get indexing job status and progress.
    
    Retrieve detailed status information for a specific indexing job.
    
    **Path Parameters:**
    - `job_id`: Unique job identifier returned from POST /index
    
    **Response:**
    - Complete job status including progress, files processed, errors, etc.
    
    **Error Cases:**
    - 404: Job not found
    - 500: Internal server error
    """
    correlation_id = getattr(req.state, 'correlation_id', 'unknown')
    
    try:
        logger.info(f"Getting job status for {job_id} [{correlation_id}]")
        
        job_status = await vault_service.get_job_status(job_id)
        
        if not job_status:
            logger.warning(f"Job not found: {job_id} [{correlation_id}]")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Indexing job '{job_id}' not found"
            )
        
        return {
            "status": "success",
            "data": job_status,
            "message": f"Job status retrieved for '{job_id}'",
            "timestamp": time.time(),
            "request_id": correlation_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting job status {job_id}: {str(e)} [{correlation_id}]", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error retrieving job status"
        )


@router.get("/jobs", response_model=APIResponse)
async def get_all_indexing_jobs(
    req: Request,
    vault_service: VaultService = Depends(get_vault_service)
) -> Dict[str, Any]:
    """
    Get all indexing jobs (active and recent).
    
    Retrieve information about all active indexing jobs and recent job history.
    
    **Response:**
    - `active_jobs`: List of currently running jobs
    - `recent_jobs`: List of recently completed jobs
    - `total_active`: Number of active jobs
    - `total_history`: Total number of jobs in history
    
    **Use Cases:**
    - Admin dashboard monitoring
    - Job queue management
    - System status overview
    """
    correlation_id = getattr(req.state, 'correlation_id', 'unknown')
    
    try:
        logger.info(f"Getting all indexing jobs [{correlation_id}]")
        
        jobs_info = await vault_service.get_all_jobs()
        
        return {
            "status": "success",
            "data": jobs_info,
            "message": f"Retrieved {jobs_info['total_active']} active jobs and {len(jobs_info['recent_jobs'])} recent jobs",
            "timestamp": time.time(),
            "request_id": correlation_id
        }
        
    except Exception as e:
        logger.error(f"Error getting all jobs: {str(e)} [{correlation_id}]", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error retrieving jobs"
        )