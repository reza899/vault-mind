"""
Performance Monitoring API Routes - Endpoints for performance metrics and benchmarks.
Provides access to real-time performance data, benchmarks, and system health.
"""
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel, Field

from services.performance_monitor import get_performance_monitor, PerformanceMonitor

router = APIRouter(prefix="/api/v1/performance", tags=["performance"])


class MetricRequest(BaseModel):
    """Request model for recording custom metrics."""
    name: str = Field(..., description="Metric name")
    value: float = Field(..., description="Metric value")
    unit: str = Field(..., description="Unit of measurement")
    category: str = Field("custom", description="Metric category")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")


class BenchmarkRequest(BaseModel):
    """Request model for benchmark configuration."""
    benchmark_name: str = Field(..., description="Name of the benchmark")
    operation_type: str = Field(..., description="Type of operation to benchmark")
    parameters: Optional[Dict[str, Any]] = Field(None, description="Benchmark parameters")


class MetricSummaryResponse(BaseModel):
    """Response model for metric summaries."""
    name: str
    count: int
    avg: float
    min: float
    max: float
    median: float
    latest: float
    unit: str
    timespan_seconds: int


class BenchmarkResultResponse(BaseModel):
    """Response model for benchmark results."""
    benchmark_name: str
    duration_ms: float
    operations_count: int
    operations_per_second: float
    memory_usage_mb: float
    cpu_usage_percent: float
    success: bool
    error_message: Optional[str]
    timestamp: float


class SystemMetricsResponse(BaseModel):
    """Response model for system metrics."""
    cpu_percent: float
    memory_percent: float
    memory_available_gb: float
    disk_percent: float
    disk_free_gb: float
    timestamp: float


class HealthStatusResponse(BaseModel):
    """Response model for health status."""
    status: str
    issues: List[str]
    last_check: float


@router.get("/dashboard")
async def get_performance_dashboard(
    monitor: PerformanceMonitor = Depends(get_performance_monitor)
) -> Dict[str, Any]:
    """Get comprehensive performance dashboard data."""
    try:
        dashboard = monitor.get_performance_dashboard()
        return {
            "status": "success",
            "data": dashboard
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get performance dashboard: {str(e)}")


@router.get("/metrics/summary")
async def get_metrics_summary(
    since_hours: int = Query(1, ge=1, le=168, description="Time range in hours (max 1 week)"),
    monitor: PerformanceMonitor = Depends(get_performance_monitor)
) -> Dict[str, Any]:
    """Get comprehensive metrics summary for the specified time range."""
    try:
        summary = monitor.get_metrics_summary(since_hours)
        return {
            "status": "success",
            "data": summary
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get metrics summary: {str(e)}")


@router.get("/metrics/{metric_name}")
async def get_metric_details(
    metric_name: str,
    since_seconds: int = Query(3600, ge=60, le=604800, description="Time range in seconds"),
    monitor: PerformanceMonitor = Depends(get_performance_monitor)
) -> Dict[str, Any]:
    """Get detailed information for a specific metric."""
    try:
        metrics = monitor.metrics_collector.get_metrics(metric_name, since_seconds)
        summary = monitor.metrics_collector.get_metric_summary(metric_name, since_seconds)
        
        return {
            "status": "success",
            "data": {
                "metric_name": metric_name,
                "summary": summary,
                "data_points": [m.to_dict() for m in metrics[-100:]]  # Last 100 points
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get metric details: {str(e)}")


@router.post("/metrics")
async def record_custom_metric(
    metric: MetricRequest,
    monitor: PerformanceMonitor = Depends(get_performance_monitor)
) -> Dict[str, str]:
    """Record a custom performance metric."""
    try:
        await monitor.record_metric(
            name=metric.name,
            value=metric.value,
            unit=metric.unit,
            category=metric.category,
            **(metric.metadata or {})
        )
        
        return {"message": f"Metric '{metric.name}' recorded successfully"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to record metric: {str(e)}")


@router.get("/benchmarks/summary")
async def get_benchmark_summary(
    since_hours: int = Query(24, ge=1, le=168, description="Time range in hours (max 1 week)"),
    monitor: PerformanceMonitor = Depends(get_performance_monitor)
) -> Dict[str, Any]:
    """Get benchmark results summary for the specified time range."""
    try:
        summary = monitor.get_benchmark_summary(since_hours)
        return {
            "status": "success",
            "data": summary
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get benchmark summary: {str(e)}")


@router.post("/benchmarks/vault-indexing/{vault_name}")
async def run_vault_indexing_benchmark(
    vault_name: str,
    background_tasks: BackgroundTasks,
    monitor: PerformanceMonitor = Depends(get_performance_monitor)
) -> Dict[str, str]:
    """Run a vault indexing performance benchmark."""
    try:
        async def benchmark_operation():
            """Mock indexing benchmark - in real implementation, this would run actual indexing."""
            # Import here to avoid circular dependencies
            from services.file_change_service import get_file_change_service
            
            file_change_service = get_file_change_service()
            vault_configs = file_change_service.get_vault_configs()
            
            if vault_name not in vault_configs:
                raise ValueError(f"Vault '{vault_name}' not found in configurations")
            
            vault_config = vault_configs[vault_name]
            
            # Simulate indexing operations count based on vault size
            from pathlib import Path
            vault_path = Path(vault_config['vault_path'])
            
            operations_count = 0
            if vault_path.exists():
                # Count markdown files
                operations_count = len(list(vault_path.rglob("*.md")))
            
            # Simulate some processing time
            import asyncio
            await asyncio.sleep(0.1 * operations_count)  # 100ms per file simulation
            
            return {"operations_count": operations_count}
        
        # Run benchmark in background
        background_tasks.add_task(
            monitor.run_benchmark,
            f"vault_indexing_{vault_name}",
            benchmark_operation
        )
        
        return {"message": f"Vault indexing benchmark started for '{vault_name}'"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start benchmark: {str(e)}")


@router.post("/benchmarks/search/{vault_name}")
async def run_search_benchmark(
    vault_name: str,
    background_tasks: BackgroundTasks,
    monitor: PerformanceMonitor = Depends(get_performance_monitor),
    query: str = Query(..., description="Search query to benchmark"),
    iterations: int = Query(10, ge=1, le=100, description="Number of search iterations")
) -> Dict[str, str]:
    """Run a search performance benchmark."""
    try:
        async def benchmark_operation():
            """Search benchmark operation."""
            # Import here to avoid circular dependencies
            from api.dependencies import get_vault_service
            
            vault_service = get_vault_service()
            
            operations_count = 0
            for i in range(iterations):
                try:
                    await vault_service.search_vault(
                        vault_name=vault_name,
                        query=query,
                        limit=10
                    )
                    operations_count += 1
                except Exception:
                    # Continue benchmarking even if some searches fail
                    pass
            
            return {"operations_count": operations_count}
        
        # Run benchmark in background
        background_tasks.add_task(
            monitor.run_benchmark,
            f"search_{vault_name}",
            benchmark_operation
        )
        
        return {"message": f"Search benchmark started for vault '{vault_name}' with query '{query[:50]}'"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start search benchmark: {str(e)}")


@router.get("/system", response_model=SystemMetricsResponse)
async def get_system_metrics(
    monitor: PerformanceMonitor = Depends(get_performance_monitor)
) -> SystemMetricsResponse:
    """Get current system metrics."""
    try:
        metrics = monitor._get_current_system_metrics()
        return SystemMetricsResponse(**metrics)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get system metrics: {str(e)}")


@router.get("/health", response_model=HealthStatusResponse)
async def get_health_status(
    monitor: PerformanceMonitor = Depends(get_performance_monitor)
) -> HealthStatusResponse:
    """Get system health status."""
    try:
        health = monitor._get_health_status()
        return HealthStatusResponse(**health)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get health status: {str(e)}")


@router.get("/thresholds")
async def get_performance_thresholds(
    monitor: PerformanceMonitor = Depends(get_performance_monitor)
) -> Dict[str, Any]:
    """Get current performance thresholds."""
    try:
        return {
            "status": "success",
            "data": {
                "thresholds": monitor.thresholds,
                "description": {
                    "indexing_duration_ms": "Maximum time for indexing operations",
                    "search_duration_ms": "Maximum time for search operations",
                    "memory_usage_mb": "Maximum memory usage",
                    "cpu_usage_percent": "Maximum CPU usage percentage",
                    "disk_usage_percent": "Maximum disk usage percentage"
                }
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get thresholds: {str(e)}")


@router.put("/thresholds")
async def update_performance_thresholds(
    thresholds: Dict[str, float],
    monitor: PerformanceMonitor = Depends(get_performance_monitor)
) -> Dict[str, str]:
    """Update performance thresholds."""
    try:
        # Validate threshold keys
        valid_keys = set(monitor.thresholds.keys())
        invalid_keys = set(thresholds.keys()) - valid_keys
        
        if invalid_keys:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid threshold keys: {invalid_keys}. Valid keys: {valid_keys}"
            )
        
        # Update thresholds
        monitor.thresholds.update(thresholds)
        
        return {"message": f"Updated {len(thresholds)} performance thresholds"}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update thresholds: {str(e)}")


@router.get("/alerts")
async def get_recent_alerts(
    since_minutes: int = Query(60, ge=1, le=1440, description="Time range in minutes (max 24 hours)"),
    monitor: PerformanceMonitor = Depends(get_performance_monitor)
) -> Dict[str, Any]:
    """Get recent performance alerts."""
    try:
        alerts = monitor._get_recent_alerts(since_minutes)
        return {
            "status": "success",
            "data": {
                "alerts": alerts,
                "count": len(alerts),
                "timespan_minutes": since_minutes
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get alerts: {str(e)}")


@router.post("/service/start")
async def start_performance_monitoring(
    background_tasks: BackgroundTasks,
    monitor: PerformanceMonitor = Depends(get_performance_monitor)
) -> Dict[str, str]:
    """Start the performance monitoring service."""
    try:
        if monitor.running:
            return {"message": "Performance monitoring is already running"}
        
        background_tasks.add_task(monitor.start)
        return {"message": "Performance monitoring service start initiated"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start performance monitoring: {str(e)}")


@router.post("/service/stop")
async def stop_performance_monitoring(
    background_tasks: BackgroundTasks,
    monitor: PerformanceMonitor = Depends(get_performance_monitor)
) -> Dict[str, str]:
    """Stop the performance monitoring service."""
    try:
        if not monitor.running:
            return {"message": "Performance monitoring is not running"}
        
        background_tasks.add_task(monitor.stop)
        return {"message": "Performance monitoring service stop initiated"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop performance monitoring: {str(e)}")


@router.get("/stats")
async def get_performance_stats(
    monitor: PerformanceMonitor = Depends(get_performance_monitor)
) -> Dict[str, Any]:
    """Get overall performance monitoring statistics."""
    try:
        metrics_summary = monitor.get_metrics_summary(since_hours=24)
        benchmark_summary = monitor.get_benchmark_summary(since_hours=24)
        system_info = monitor._get_system_info()
        
        return {
            "status": "success",
            "data": {
                "service_running": monitor.running,
                "system_info": system_info,
                "metrics_24h": {
                    "total_metrics": metrics_summary.get('total_metrics', 0),
                    "categories": list(metrics_summary.get('categories', {}).keys())
                },
                "benchmarks_24h": {
                    "total_benchmarks": benchmark_summary.get('total_benchmarks', 0),
                    "successful_benchmarks": benchmark_summary.get('successful_benchmarks', 0),
                    "failed_benchmarks": benchmark_summary.get('failed_benchmarks', 0)
                }
            }
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get performance stats: {str(e)}")