"""
File Change Detection API Routes - Endpoints for monitoring file system changes.
Provides real-time file change notifications and vault watching configuration.
"""
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel, Field

from services.file_change_service import get_file_change_service, FileChangeService

router = APIRouter(prefix="/api/v1/file-changes", tags=["file-changes"])


class VaultWatchConfigRequest(BaseModel):
    """Request model for vault watch configuration."""
    vault_name: str = Field(..., description="Name of the vault")
    vault_path: str = Field(..., description="Path to the vault directory")
    enabled: bool = Field(True, description="Whether watching is enabled")
    check_interval: int = Field(300, ge=60, le=3600, description="Periodic scan interval in seconds")
    debounce_delay: float = Field(2.0, ge=0.5, le=10.0, description="Debounce delay for events in seconds")


class VaultWatchConfigResponse(BaseModel):
    """Response model for vault watch configuration."""
    vault_name: str
    vault_path: str
    enabled: bool
    check_interval: int
    debounce_delay: float


class FileChangeEventResponse(BaseModel):
    """Response model for file change events."""
    file_path: str
    event_type: str
    timestamp: float
    vault_name: str
    old_path: Optional[str] = None


class VaultChangesResponse(BaseModel):
    """Response model for vault change scan results."""
    vault_name: str
    scan_timestamp: float
    added: List[str] = Field(..., description="List of added files")
    modified: List[str] = Field(..., description="List of modified files")  
    deleted: List[str] = Field(..., description="List of deleted files")
    total_changes: int = Field(..., description="Total number of changes")


class ServiceStatsResponse(BaseModel):
    """Response model for file change service statistics."""
    events_processed: int
    last_scan_time: Optional[float]
    active_watchers: int
    configured_vaults: int
    queue_size: int
    debounced_events: int
    watchdog_available: bool
    total_files_tracked: int


@router.get("/stats", response_model=ServiceStatsResponse)
async def get_service_stats(
    service: FileChangeService = Depends(get_file_change_service)
) -> ServiceStatsResponse:
    """Get file change service statistics and status."""
    try:
        stats = service.get_service_stats()
        return ServiceStatsResponse(**stats)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get service stats: {str(e)}")


@router.get("/vaults", response_model=Dict[str, VaultWatchConfigResponse])
async def get_vault_configs(
    service: FileChangeService = Depends(get_file_change_service)
) -> Dict[str, VaultWatchConfigResponse]:
    """Get all vault watch configurations."""
    try:
        configs = service.get_vault_configs()
        return {
            name: VaultWatchConfigResponse(**config) 
            for name, config in configs.items()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get vault configurations: {str(e)}")


@router.post("/vaults/{vault_name}")
async def add_vault_watch(
    vault_name: str,
    config: VaultWatchConfigRequest,
    background_tasks: BackgroundTasks,
    service: FileChangeService = Depends(get_file_change_service)
) -> Dict[str, str]:
    """Add or update a vault watch configuration."""
    try:
        # Validate vault name matches
        if vault_name != config.vault_name:
            raise HTTPException(
                status_code=400, 
                detail="Vault name in URL must match vault name in request body"
            )
        
        background_tasks.add_task(
            service.add_vault_watch,
            vault_name=config.vault_name,
            vault_path=config.vault_path,
            enabled=config.enabled,
            check_interval=config.check_interval,
            debounce_delay=config.debounce_delay
        )
        
        return {"message": f"Vault watch configuration added for '{vault_name}'"}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add vault watch: {str(e)}")


@router.delete("/vaults/{vault_name}")
async def remove_vault_watch(
    vault_name: str,
    background_tasks: BackgroundTasks,
    service: FileChangeService = Depends(get_file_change_service)
) -> Dict[str, str]:
    """Remove a vault from file change monitoring."""
    try:
        background_tasks.add_task(service.remove_vault_watch, vault_name)
        return {"message": f"Vault watch removed for '{vault_name}'"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to remove vault watch: {str(e)}")


@router.put("/vaults/{vault_name}/enable")
async def enable_vault_watch(
    vault_name: str,
    background_tasks: BackgroundTasks,
    service: FileChangeService = Depends(get_file_change_service),
    enabled: bool = Query(True, description="Whether to enable or disable watching")
) -> Dict[str, str]:
    """Enable or disable file change monitoring for a vault."""
    try:
        background_tasks.add_task(service.enable_vault_watch, vault_name, enabled)
        action = "enabled" if enabled else "disabled"
        return {"message": f"File watching {action} for vault '{vault_name}'"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update vault watch status: {str(e)}")


@router.post("/vaults/{vault_name}/scan", response_model=VaultChangesResponse)
async def scan_vault_changes(
    vault_name: str,
    service: FileChangeService = Depends(get_file_change_service)
) -> VaultChangesResponse:
    """Manually trigger a file change scan for a specific vault."""
    try:
        changes = await service.scan_vault_changes(vault_name)
        
        total_changes = len(changes['added']) + len(changes['modified']) + len(changes['deleted'])
        
        return VaultChangesResponse(
            vault_name=vault_name,
            scan_timestamp=service.stats.get('last_scan_time', 0),
            added=changes['added'],
            modified=changes['modified'],
            deleted=changes['deleted'],
            total_changes=total_changes
        )
    
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to scan vault changes: {str(e)}")


@router.get("/vaults/{vault_name}/config", response_model=VaultWatchConfigResponse)
async def get_vault_config(
    vault_name: str,
    service: FileChangeService = Depends(get_file_change_service)
) -> VaultWatchConfigResponse:
    """Get watch configuration for a specific vault."""
    try:
        configs = service.get_vault_configs()
        
        if vault_name not in configs:
            raise HTTPException(status_code=404, detail=f"Vault '{vault_name}' is not configured for watching")
        
        return VaultWatchConfigResponse(**configs[vault_name])
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get vault configuration: {str(e)}")


@router.put("/vaults/{vault_name}/config")
async def update_vault_config(
    vault_name: str,
    config: VaultWatchConfigRequest,
    background_tasks: BackgroundTasks,
    service: FileChangeService = Depends(get_file_change_service)
) -> Dict[str, str]:
    """Update watch configuration for a specific vault."""
    try:
        # Validate vault name matches
        if vault_name != config.vault_name:
            raise HTTPException(
                status_code=400, 
                detail="Vault name in URL must match vault name in request body"
            )
        
        # Check if vault exists
        configs = service.get_vault_configs()
        if vault_name not in configs:
            raise HTTPException(status_code=404, detail=f"Vault '{vault_name}' is not configured for watching")
        
        background_tasks.add_task(
            service.add_vault_watch,  # This will update existing config
            vault_name=config.vault_name,
            vault_path=config.vault_path,
            enabled=config.enabled,
            check_interval=config.check_interval,
            debounce_delay=config.debounce_delay
        )
        
        return {"message": f"Vault watch configuration updated for '{vault_name}'"}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update vault configuration: {str(e)}")


@router.post("/service/start")
async def start_service(
    background_tasks: BackgroundTasks,
    service: FileChangeService = Depends(get_file_change_service)
) -> Dict[str, str]:
    """Start the file change detection service."""
    try:
        if service.running:
            return {"message": "File change service is already running"}
        
        background_tasks.add_task(service.start)
        return {"message": "File change service start initiated"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start service: {str(e)}")


@router.post("/service/stop")
async def stop_service(
    background_tasks: BackgroundTasks,
    service: FileChangeService = Depends(get_file_change_service)
) -> Dict[str, str]:
    """Stop the file change detection service."""
    try:
        if not service.running:
            return {"message": "File change service is not running"}
        
        background_tasks.add_task(service.stop)
        return {"message": "File change service stop initiated"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop service: {str(e)}")


@router.get("/health")
async def health_check(
    service: FileChangeService = Depends(get_file_change_service)
) -> Dict[str, Any]:
    """Health check for the file change detection service."""
    try:
        stats = service.get_service_stats()
        
        status = "healthy" if service.running else "stopped"
        
        return {
            "status": status,
            "running": service.running,
            "watchdog_available": stats['watchdog_available'],
            "active_watchers": stats['active_watchers'],
            "configured_vaults": stats['configured_vaults'],
            "events_processed": stats['events_processed'],
            "last_check": stats.get('last_scan_time')
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")