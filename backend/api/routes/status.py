"""
Status routes for the Vault Mind API.
Provides system health, monitoring, and operational status information.
"""
import logging
import time
import psutil
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Request, status, Depends, Query

from api.models.requests import StatusRequest
from api.models.responses import APIResponse, StatusResponse, SystemHealth, DatabaseHealth
from services.vault_service import VaultService
from api.dependencies import get_vault_service

logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/status", tags=["Status"])

# Track service start time for uptime calculation
_service_start_time = time.time()


@router.get("", response_model=APIResponse)
async def get_system_status(
    req: Request,
    vault_service: VaultService = Depends(get_vault_service),
    vault_name: Optional[str] = Query(default=None, description="Optional specific vault to check"),
    job_id: Optional[str] = Query(default=None, description="Optional specific job to check"),
    include_metrics: bool = Query(default=True, description="Include performance metrics")
) -> Dict[str, Any]:
    """
    Get comprehensive system status and health information.
    
    Provides detailed status information about the Vault Mind system including:
    - Overall system health and uptime
    - Database connectivity and performance
    - Active indexing jobs and queue status
    - Vault collection statistics
    - Resource usage metrics
    
    **Query Parameters:**
    - `vault_name`: Get status for a specific vault collection
    - `job_id`: Get status for a specific indexing job
    - `include_metrics`: Include system performance metrics (CPU, memory)
    
    **Response Includes:**
    - `system_status`: Overall health, uptime, resource usage
    - `vault_collections`: List of all indexed vaults with statistics
    - `active_jobs`: Currently running indexing jobs
    - `database_health`: ChromaDB connection and performance metrics
    
    **System Health Levels:**
    - `healthy`: All systems operational, normal performance
    - `degraded`: Some issues detected, functionality may be limited
    - `unhealthy`: Critical issues, service may be unavailable
    
    **Use Cases:**
    - Health check monitoring and alerting
    - Admin dashboard status display
    - Debugging and troubleshooting
    - Performance monitoring
    - Load balancer health checks
    """
    correlation_id = getattr(req.state, 'correlation_id', 'unknown')
    
    try:
        logger.info(f"System status request - Vault: {vault_name}, Job: {job_id} [{correlation_id}]")
        
        # Get overall system status from service
        system_status = await vault_service.get_system_status()
        
        # Get system health metrics
        uptime_seconds = time.time() - _service_start_time
        
        # Get system resource metrics if requested
        system_health_data = {
            "service_status": system_status["service_status"],
            "uptime_seconds": uptime_seconds,
            "memory_usage_mb": 0.0,
            "cpu_usage_percent": 0.0
        }
        
        if include_metrics:
            try:
                # Get system metrics
                memory_info = psutil.virtual_memory()
                cpu_percent = psutil.cpu_percent(interval=0.1)
                
                system_health_data.update({
                    "memory_usage_mb": memory_info.used / 1024 / 1024,
                    "cpu_usage_percent": cpu_percent
                })
            except Exception as e:
                logger.warning(f"Failed to get system metrics: {e}")
                # Continue without metrics rather than failing the request
        
        system_health = SystemHealth(**system_health_data)
        
        # Get vault collections
        vault_collections = await vault_service.get_vault_collections()
        
        # Get job information
        jobs_info = await vault_service.get_all_jobs()
        active_jobs = jobs_info["active_jobs"]
        
        # If specific vault requested, filter collections
        if vault_name:
            vault_collections = [v for v in vault_collections if v.get("vault_name") == vault_name]
            if not vault_collections:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Vault '{vault_name}' not found"
                )
        
        # If specific job requested, get job status
        specific_job = None
        if job_id:
            specific_job = await vault_service.get_job_status(job_id)
            if not specific_job:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Job '{job_id}' not found"
                )
        
        # Prepare database health information
        db_health = system_status["database_health"]
        database_health = DatabaseHealth(
            connected=db_health["status"] == "healthy",
            response_time_ms=float(db_health.get("response_time_ms", 0)),
            total_collections=system_status["total_collections"],
            total_documents=system_status["total_documents"]
        )
        
        # Build response data
        response_data = StatusResponse(
            system_status=system_health,
            vault_collections=vault_collections,
            active_jobs=active_jobs,
            database_health=database_health
        )
        
        # Add specific job info if requested
        status_dict = response_data.dict()
        if specific_job:
            status_dict["specific_job"] = specific_job
        
        # Determine overall status message
        total_vaults = len(vault_collections)
        total_jobs = len(active_jobs)
        status_msg = f"System {system_health.service_status} - {total_vaults} vaults, {total_jobs} active jobs"
        
        if vault_name:
            status_msg += f" (vault: {vault_name})"
        if job_id:
            status_msg += f" (job: {job_id})"
        
        return {
            "status": "success",
            "data": status_dict,
            "message": status_msg,
            "timestamp": time.time(),
            "request_id": correlation_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting system status: {str(e)} [{correlation_id}]", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error retrieving system status"
        )


@router.post("", response_model=APIResponse)
async def get_system_status_with_body(
    request: StatusRequest,
    req: Request,
    vault_service: VaultService = Depends(get_vault_service)
) -> Dict[str, Any]:
    """
    Get system status with request body parameters (alternative to query parameters).
    
    Provides the same status functionality as GET /status but accepts parameters
    in the request body for programmatic usage and complex filtering.
    
    **Request Body:**
    - `vault_name`: Optional specific vault to check
    - `job_id`: Optional specific job to check  
    - `include_metrics`: Include performance metrics (default: true)
    
    All other behavior is identical to GET /status.
    """
    correlation_id = getattr(req.state, 'correlation_id', 'unknown')
    
    try:
        logger.info(f"System status POST request - Vault: {request.vault_name}, Job: {request.job_id} [{correlation_id}]")
        
        # Delegate to the main status logic by calling the GET endpoint logic
        # This avoids code duplication while providing both interfaces
        
        # Create a mock request with query parameters
        class MockRequest:
            def __init__(self, original_req, vault_name, job_id, include_metrics):
                self.state = original_req.state
                self.vault_name = vault_name
                self.job_id = job_id
                self.include_metrics = include_metrics
        
        # Call the main status function with converted parameters
        return await get_system_status(
            req=req,
            vault_service=vault_service,
            vault_name=request.vault_name,
            job_id=request.job_id,
            include_metrics=request.include_metrics
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in status POST: {str(e)} [{correlation_id}]", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error retrieving system status"
        )


@router.get("/health", response_model=APIResponse)
async def health_check(
    req: Request,
    vault_service: VaultService = Depends(get_vault_service)
) -> Dict[str, Any]:
    """
    Lightweight health check endpoint for monitoring and load balancers.
    
    Provides quick health status without detailed metrics or heavy operations.
    Designed for high-frequency health check polling.
    
    **Response:**
    - `healthy`: All core services operational
    - `degraded`: Some services have issues
    - `unhealthy`: Critical services unavailable
    
    **Performance:**
    - Target response time: <100ms
    - Minimal resource usage
    - Safe for frequent polling (every 5-30 seconds)
    
    **Use Cases:**
    - Load balancer health checks
    - Kubernetes liveness/readiness probes
    - Monitoring system alerts
    - Quick status verification
    """
    correlation_id = getattr(req.state, 'correlation_id', 'unknown')
    
    try:
        # Quick health check without heavy operations
        health_result = await vault_service.health_check()
        
        # Simple response for monitoring systems
        is_healthy = health_result["status"] == "healthy"
        
        return {
            "status": "success",
            "data": {
                "healthy": is_healthy,
                "service_status": health_result["status"],
                "database_connected": health_result.get("database", {}).get("connected", False),
                "embedding_service_status": health_result.get("embedding_service", {}).get("status", "unknown"),
                "uptime_seconds": time.time() - _service_start_time
            },
            "message": f"Health check: {health_result['status']}",
            "timestamp": time.time(),
            "request_id": correlation_id
        }
        
    except Exception as e:
        logger.error(f"Health check failed: {str(e)} [{correlation_id}]", exc_info=True)
        
        # Return unhealthy status but don't raise exception
        # This allows monitoring systems to detect the unhealthy state
        return {
            "status": "error",
            "data": {
                "healthy": False,
                "service_status": "unhealthy",
                "error": "Health check failed"
            },
            "message": "Health check failed",
            "timestamp": time.time(),
            "request_id": correlation_id
        }


@router.get("/metrics", response_model=APIResponse)
async def get_performance_metrics(
    req: Request,
    vault_service: VaultService = Depends(get_vault_service)
) -> Dict[str, Any]:
    """
    Get detailed performance metrics and statistics.
    
    Provides comprehensive performance data for monitoring, alerting,
    and system optimization.
    
    **Metrics Included:**
    - System resource usage (CPU, memory, disk)
    - Database performance statistics
    - Embedding service metrics
    - Request/response timing
    - Error rates and counts
    - Job processing statistics
    
    **Use Cases:**
    - Performance monitoring dashboards
    - Capacity planning
    - System optimization
    - Troubleshooting performance issues
    """
    correlation_id = getattr(req.state, 'correlation_id', 'unknown')
    
    try:
        logger.info(f"Performance metrics request [{correlation_id}]")
        
        # Get service metrics
        system_status = await vault_service.get_system_status()
        
        # Get system resource metrics
        try:
            memory_info = psutil.virtual_memory()
            cpu_percent = psutil.cpu_percent(interval=0.1)
            disk_usage = psutil.disk_usage('/')
            
            system_metrics = {
                "cpu_percent": cpu_percent,
                "memory_total_mb": memory_info.total / 1024 / 1024,
                "memory_used_mb": memory_info.used / 1024 / 1024,
                "memory_percent": memory_info.percent,
                "disk_total_gb": disk_usage.total / 1024 / 1024 / 1024,
                "disk_used_gb": disk_usage.used / 1024 / 1024 / 1024,
                "disk_percent": (disk_usage.used / disk_usage.total) * 100
            }
        except Exception as e:
            logger.warning(f"Failed to get system metrics: {e}")
            system_metrics = {"error": "System metrics unavailable"}
        
        # Get embedding service metrics
        embedding_metrics = system_status.get("embedding_service_health", {}).get("metrics", {})
        
        # Get job statistics
        jobs_info = await vault_service.get_all_jobs()
        
        metrics_data = {
            "system_metrics": system_metrics,
            "embedding_metrics": embedding_metrics,
            "job_statistics": {
                "active_jobs": len(jobs_info["active_jobs"]),
                "total_history": jobs_info["total_history"],
                "recent_jobs": len(jobs_info["recent_jobs"])
            },
            "database_metrics": {
                "total_collections": system_status["total_collections"],
                "total_documents": system_status["total_documents"],
                "connection_status": system_status["database_health"]["status"]
            },
            "uptime_seconds": time.time() - _service_start_time
        }
        
        return {
            "status": "success",
            "data": metrics_data,
            "message": "Performance metrics retrieved successfully",
            "timestamp": time.time(),
            "request_id": correlation_id
        }
        
    except Exception as e:
        logger.error(f"Error getting performance metrics: {str(e)} [{correlation_id}]", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error retrieving performance metrics"
        )