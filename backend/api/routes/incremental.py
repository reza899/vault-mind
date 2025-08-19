"""
Incremental Update API Routes - Endpoints for managing incremental vault updates.
Provides manual and automatic incremental indexing based on file changes.
"""
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field

from api.dependencies import get_vault_service
from services.vault_service import VaultService

router = APIRouter(prefix="/api/v1/incremental", tags=["incremental"])


class FileChangesRequest(BaseModel):
    """Request model for manual incremental update."""
    added: List[str] = Field(default=[], description="List of added file paths")
    modified: List[str] = Field(default=[], description="List of modified file paths")
    deleted: List[str] = Field(default=[], description="List of deleted file paths")


class IncrementalUpdateResponse(BaseModel):
    """Response model for incremental update results."""
    vault_name: str
    files_processed: int
    documents_added: int
    documents_updated: int
    documents_deleted: int
    chunks_created: int
    chunks_updated: int
    chunks_deleted: int
    duration_seconds: float
    errors: List[str]
    start_time: str
    end_time: str


class IncrementalSetupRequest(BaseModel):
    """Request model for setting up incremental updates."""
    vault_name: str = Field(..., description="Name of the vault")
    vault_path: str = Field(..., description="Path to the vault directory")
    auto_enable: bool = Field(True, description="Whether to automatically enable incremental updates")


@router.post("/update/{vault_name}", response_model=IncrementalUpdateResponse)
async def perform_incremental_update(
    vault_name: str,
    changes: FileChangesRequest,
    vault_service: VaultService = Depends(get_vault_service)
) -> IncrementalUpdateResponse:
    """
    Perform a manual incremental update for a vault based on provided file changes.
    """
    try:
        # Convert request to expected format
        changes_dict = {
            'added': changes.added,
            'modified': changes.modified,
            'deleted': changes.deleted
        }
        
        # Validate that we have some changes
        total_changes = len(changes.added) + len(changes.modified) + len(changes.deleted)
        if total_changes == 0:
            raise HTTPException(
                status_code=400, 
                detail="No file changes provided. At least one file must be added, modified, or deleted."
            )
        
        # Perform incremental update
        result = await vault_service.incremental_update(vault_name, changes_dict)
        
        # Convert datetime objects to strings for JSON serialization
        return IncrementalUpdateResponse(
            vault_name=result['vault_name'],
            files_processed=result['files_processed'],
            documents_added=result['documents_added'],
            documents_updated=result['documents_updated'],
            documents_deleted=result['documents_deleted'],
            chunks_created=result['chunks_created'],
            chunks_updated=result['chunks_updated'],
            chunks_deleted=result['chunks_deleted'],
            duration_seconds=result['duration_seconds'],
            errors=result['errors'],
            start_time=result['start_time'].isoformat(),
            end_time=result['end_time'].isoformat()
        )
    
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Incremental update failed: {str(e)}")


@router.post("/setup/{vault_name}")
async def setup_incremental_updates(
    vault_name: str,
    setup_request: IncrementalSetupRequest,
    background_tasks: BackgroundTasks,
    vault_service: VaultService = Depends(get_vault_service)
) -> Dict[str, str]:
    """
    Set up automatic incremental updates for a vault.
    This connects file change monitoring to automatic incremental indexing.
    """
    try:
        # Validate vault name matches
        if vault_name != setup_request.vault_name:
            raise HTTPException(
                status_code=400,
                detail="Vault name in URL must match vault name in request body"
            )
        
        # Set up incremental updates in background
        background_tasks.add_task(
            vault_service.setup_incremental_updates,
            vault_name=setup_request.vault_name,
            vault_path=setup_request.vault_path
        )
        
        return {
            "message": f"Incremental updates setup initiated for vault '{vault_name}'",
            "auto_enable": setup_request.auto_enable
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to setup incremental updates: {str(e)}")


@router.post("/trigger-scan/{vault_name}", response_model=IncrementalUpdateResponse)
async def trigger_vault_scan_and_update(
    vault_name: str,
    vault_service: VaultService = Depends(get_vault_service)
) -> IncrementalUpdateResponse:
    """
    Trigger a vault scan for changes and perform incremental update if changes are found.
    This manually scans the filesystem and updates the vault accordingly.
    """
    try:
        # Import file change service to perform scan
        from services.file_change_service import get_file_change_service
        
        file_change_service = get_file_change_service()
        
        # Scan for changes
        changes = await file_change_service.scan_vault_changes(vault_name)
        
        # Check if there are any changes
        total_changes = len(changes['added']) + len(changes['modified']) + len(changes['deleted'])
        
        if total_changes == 0:
            # No changes found, return empty result
            from datetime import datetime
            now = datetime.now()
            return IncrementalUpdateResponse(
                vault_name=vault_name,
                files_processed=0,
                documents_added=0,
                documents_updated=0,
                documents_deleted=0,
                chunks_created=0,
                chunks_updated=0,
                chunks_deleted=0,
                duration_seconds=0.0,
                errors=[],
                start_time=now.isoformat(),
                end_time=now.isoformat()
            )
        
        # Perform incremental update with detected changes
        result = await vault_service.incremental_update(vault_name, changes)
        
        # Convert datetime objects to strings for JSON serialization
        return IncrementalUpdateResponse(
            vault_name=result['vault_name'],
            files_processed=result['files_processed'],
            documents_added=result['documents_added'],
            documents_updated=result['documents_updated'],
            documents_deleted=result['documents_deleted'],
            chunks_created=result['chunks_created'],
            chunks_updated=result['chunks_updated'],
            chunks_deleted=result['chunks_deleted'],
            duration_seconds=result['duration_seconds'],
            errors=result['errors'],
            start_time=result['start_time'].isoformat(),
            end_time=result['end_time'].isoformat()
        )
    
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scan and update failed: {str(e)}")


@router.get("/status/{vault_name}")
async def get_incremental_status(
    vault_name: str,
    vault_service: VaultService = Depends(get_vault_service)
) -> Dict[str, Any]:
    """
    Get the incremental update status and configuration for a vault.
    """
    try:
        # Import file change service to check configuration
        from services.file_change_service import get_file_change_service
        
        file_change_service = get_file_change_service()
        
        # Get vault configurations
        vault_configs = file_change_service.get_vault_configs()
        service_stats = file_change_service.get_service_stats()
        
        # Check if vault is configured for incremental updates
        vault_config = vault_configs.get(vault_name)
        
        if not vault_config:
            return {
                "vault_name": vault_name,
                "incremental_enabled": False,
                "message": "Vault is not configured for incremental updates"
            }
        
        return {
            "vault_name": vault_name,
            "incremental_enabled": vault_config['enabled'],
            "vault_path": vault_config['vault_path'],
            "check_interval": vault_config['check_interval'],
            "debounce_delay": vault_config['debounce_delay'],
            "file_change_service_running": service_stats['active_watchers'] > 0,
            "last_scan_time": service_stats.get('last_scan_time'),
            "events_processed": service_stats.get('events_processed', 0)
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get incremental status: {str(e)}")


@router.delete("/disable/{vault_name}")
async def disable_incremental_updates(
    vault_name: str,
    background_tasks: BackgroundTasks
) -> Dict[str, str]:
    """
    Disable incremental updates for a vault.
    This removes the vault from file change monitoring.
    """
    try:
        # Import file change service
        from services.file_change_service import get_file_change_service
        
        file_change_service = get_file_change_service()
        
        # Remove vault from monitoring
        background_tasks.add_task(file_change_service.remove_vault_watch, vault_name)
        
        return {"message": f"Incremental updates disabled for vault '{vault_name}'"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to disable incremental updates: {str(e)}")


@router.get("/stats")
async def get_incremental_stats() -> Dict[str, Any]:
    """
    Get overall incremental update statistics and service status.
    """
    try:
        # Import file change service
        from services.file_change_service import get_file_change_service
        
        file_change_service = get_file_change_service()
        
        # Get service statistics
        stats = file_change_service.get_service_stats()
        vault_configs = file_change_service.get_vault_configs()
        
        return {
            "service_running": file_change_service.running,
            "total_vaults_monitored": len(vault_configs),
            "active_watchers": stats['active_watchers'],
            "events_processed": stats['events_processed'],
            "last_scan_time": stats.get('last_scan_time'),
            "queue_size": stats['queue_size'],
            "debounced_events": stats['debounced_events'],
            "watchdog_available": stats['watchdog_available'],
            "vault_configs": vault_configs
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get incremental stats: {str(e)}")


@router.post("/force-rebuild/{vault_name}")
async def force_rebuild_vault(
    vault_name: str,
    background_tasks: BackgroundTasks,
    vault_service: VaultService = Depends(get_vault_service)
) -> Dict[str, str]:
    """
    Force a complete rebuild of a vault index.
    This performs a full re-indexing rather than incremental updates.
    """
    try:
        # Get vault info to determine path
        from services.file_change_service import get_file_change_service
        
        file_change_service = get_file_change_service()
        vault_configs = file_change_service.get_vault_configs()
        
        if vault_name not in vault_configs:
            raise HTTPException(
                status_code=404,
                detail=f"Vault '{vault_name}' is not configured for monitoring"
            )
        
        vault_path = vault_configs[vault_name]['vault_path']
        
        # Trigger full re-indexing in background
        background_tasks.add_task(
            vault_service.index_vault,
            vault_name=vault_name,
            vault_path=vault_path,
            force_reindex=True
        )
        
        return {"message": f"Full rebuild initiated for vault '{vault_name}'"}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to initiate vault rebuild: {str(e)}")