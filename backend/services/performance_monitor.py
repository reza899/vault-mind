"""
Performance Monitor Service - Comprehensive performance tracking and benchmarking.
Provides real-time metrics, benchmarks, and performance analysis for Vault Mind.
"""
import asyncio
import logging
import time
import psutil
import json
from pathlib import Path
from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass, asdict
from collections import defaultdict, deque
import threading
import statistics
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)


@dataclass
class PerformanceMetric:
    """Represents a single performance metric."""
    name: str
    value: float
    unit: str
    timestamp: float
    category: str
    metadata: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class BenchmarkResult:
    """Represents a benchmark execution result."""
    benchmark_name: str
    duration_ms: float
    operations_count: int
    operations_per_second: float
    memory_usage_mb: float
    cpu_usage_percent: float
    success: bool
    error_message: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    timestamp: float = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = time.time()
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class MetricsCollector:
    """Collects and stores performance metrics with time-based retention."""
    
    def __init__(self, max_metrics: int = 10000, retention_hours: int = 24):
        self.max_metrics = max_metrics
        self.retention_seconds = retention_hours * 3600
        self.metrics: Dict[str, deque] = defaultdict(lambda: deque(maxlen=max_metrics))
        self.lock = threading.Lock()
    
    def record_metric(self, metric: PerformanceMetric) -> None:
        """Record a performance metric."""
        with self.lock:
            self.metrics[metric.name].append(metric)
            self._cleanup_old_metrics()
    
    def get_metrics(self, name: str, since_seconds: Optional[int] = None) -> List[PerformanceMetric]:
        """Get metrics for a specific metric name."""
        with self.lock:
            metrics = list(self.metrics[name])
            
            if since_seconds:
                cutoff_time = time.time() - since_seconds
                metrics = [m for m in metrics if m.timestamp >= cutoff_time]
            
            return metrics
    
    def get_metric_summary(self, name: str, since_seconds: int = 3600) -> Dict[str, Any]:
        """Get statistical summary for a metric."""
        metrics = self.get_metrics(name, since_seconds)
        
        if not metrics:
            return {
                'name': name,
                'count': 0,
                'avg': 0,
                'min': 0,
                'max': 0,
                'latest': 0
            }
        
        values = [m.value for m in metrics]
        
        return {
            'name': name,
            'count': len(values),
            'avg': statistics.mean(values),
            'min': min(values),
            'max': max(values),
            'median': statistics.median(values),
            'latest': values[-1] if values else 0,
            'unit': metrics[0].unit if metrics else '',
            'timespan_seconds': since_seconds
        }
    
    def _cleanup_old_metrics(self) -> None:
        """Remove metrics older than retention period."""
        cutoff_time = time.time() - self.retention_seconds
        
        for metric_name, metric_deque in self.metrics.items():
            # Create new deque with only recent metrics
            recent_metrics = deque(
                (m for m in metric_deque if m.timestamp >= cutoff_time),
                maxlen=self.max_metrics
            )
            self.metrics[metric_name] = recent_metrics


class PerformanceTimer:
    """Context manager for timing operations."""
    
    def __init__(self, name: str, collector: MetricsCollector, category: str = "timing"):
        self.name = name
        self.collector = collector
        self.category = category
        self.start_time = None
        self.end_time = None
        self.start_memory = None
        self.start_cpu = None
    
    def __enter__(self):
        self.start_time = time.time()
        self.start_memory = psutil.Process().memory_info().rss / 1024 / 1024  # MB
        self.start_cpu = psutil.cpu_percent()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.end_time = time.time()
        duration_ms = (self.end_time - self.start_time) * 1000
        
        # Record timing metric
        metric = PerformanceMetric(
            name=f"{self.name}_duration",
            value=duration_ms,
            unit="ms",
            timestamp=self.end_time,
            category=self.category,
            metadata={
                'success': exc_type is None,
                'error_type': exc_type.__name__ if exc_type else None
            }
        )
        self.collector.record_metric(metric)
        
        # Record memory metric if available
        try:
            end_memory = psutil.Process().memory_info().rss / 1024 / 1024
            memory_delta = end_memory - self.start_memory
            
            memory_metric = PerformanceMetric(
                name=f"{self.name}_memory_delta",
                value=memory_delta,
                unit="MB",
                timestamp=self.end_time,
                category="memory"
            )
            self.collector.record_metric(memory_metric)
        except Exception:
            pass  # Memory tracking is optional


class PerformanceMonitor:
    """Main performance monitoring service."""
    
    def __init__(self, data_dir: str = "./performance_data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(exist_ok=True)
        
        # Core components
        self.metrics_collector = MetricsCollector()
        self.benchmarks: List[BenchmarkResult] = []
        
        # Monitoring state
        self.running = False
        self.monitor_task: Optional[asyncio.Task] = None
        
        # Performance thresholds
        self.thresholds = {
            'indexing_duration_ms': 30000,  # 30 seconds
            'search_duration_ms': 1000,     # 1 second
            'memory_usage_mb': 1024,        # 1 GB
            'cpu_usage_percent': 80,        # 80%
            'disk_usage_percent': 90        # 90%
        }
        
        # Alert callbacks
        self.alert_callbacks: List[Callable[[Dict[str, Any]], None]] = []
    
    async def start(self) -> None:
        """Start the performance monitoring service."""
        if self.running:
            return
        
        self.running = True
        logger.info("Starting performance monitor service")
        
        # Start background monitoring
        self.monitor_task = asyncio.create_task(self._monitor_system_metrics())
        
        # Load historical data
        await self._load_historical_data()
        
        logger.info("Performance monitor service started")
    
    async def stop(self) -> None:
        """Stop the performance monitoring service."""
        if not self.running:
            return
        
        self.running = False
        logger.info("Stopping performance monitor service")
        
        # Cancel monitoring task
        if self.monitor_task:
            self.monitor_task.cancel()
            try:
                await self.monitor_task
            except asyncio.CancelledError:
                pass
        
        # Save current data
        await self._save_historical_data()
        
        logger.info("Performance monitor service stopped")
    
    def timer(self, name: str, category: str = "operation") -> PerformanceTimer:
        """Create a performance timer context manager."""
        return PerformanceTimer(name, self.metrics_collector, category)
    
    async def record_metric(self, name: str, value: float, unit: str, category: str = "custom", **metadata) -> None:
        """Record a custom performance metric."""
        metric = PerformanceMetric(
            name=name,
            value=value,
            unit=unit,
            timestamp=time.time(),
            category=category,
            metadata=metadata
        )
        self.metrics_collector.record_metric(metric)
        
        # Check thresholds
        await self._check_thresholds(metric)
    
    async def run_benchmark(self, benchmark_name: str, operation: Callable, *args, **kwargs) -> BenchmarkResult:
        """Run a performance benchmark on an operation."""
        logger.info(f"Running benchmark: {benchmark_name}")
        
        # Pre-benchmark measurements
        start_time = time.time()
        start_memory = psutil.Process().memory_info().rss / 1024 / 1024
        start_cpu = psutil.cpu_percent()
        
        success = True
        error_message = None
        operations_count = 1
        
        try:
            # Run the operation
            if asyncio.iscoroutinefunction(operation):
                result = await operation(*args, **kwargs)
            else:
                result = operation(*args, **kwargs)
            
            # Extract operation count if available
            if isinstance(result, dict) and 'operations_count' in result:
                operations_count = result['operations_count']
                
        except Exception as e:
            success = False
            error_message = str(e)
            logger.error(f"Benchmark {benchmark_name} failed: {e}")
        
        # Post-benchmark measurements
        end_time = time.time()
        end_memory = psutil.Process().memory_info().rss / 1024 / 1024
        end_cpu = psutil.cpu_percent()
        
        duration_ms = (end_time - start_time) * 1000
        memory_usage_mb = end_memory - start_memory
        
        operations_per_second = operations_count / (duration_ms / 1000) if duration_ms > 0 else 0
        
        # Create benchmark result
        benchmark_result = BenchmarkResult(
            benchmark_name=benchmark_name,
            duration_ms=duration_ms,
            operations_count=operations_count,
            operations_per_second=operations_per_second,
            memory_usage_mb=memory_usage_mb,
            cpu_usage_percent=(start_cpu + end_cpu) / 2,
            success=success,
            error_message=error_message,
            metadata={
                'args_count': len(args),
                'kwargs_count': len(kwargs),
                'start_memory_mb': start_memory,
                'end_memory_mb': end_memory
            }
        )
        
        # Store benchmark result
        self.benchmarks.append(benchmark_result)
        
        # Also record as metrics
        await self.record_metric(f"benchmark_{benchmark_name}_duration", duration_ms, "ms", "benchmark")
        await self.record_metric(f"benchmark_{benchmark_name}_ops_per_sec", operations_per_second, "ops/sec", "benchmark")
        
        logger.info(f"Benchmark {benchmark_name} completed: {duration_ms:.2f}ms, {operations_per_second:.2f} ops/sec")
        
        return benchmark_result
    
    def get_metrics_summary(self, since_hours: int = 1) -> Dict[str, Any]:
        """Get comprehensive metrics summary."""
        since_seconds = since_hours * 3600
        
        # Get all metric names
        metric_names = list(self.metrics_collector.metrics.keys())
        
        summaries = {}
        for name in metric_names:
            summaries[name] = self.metrics_collector.get_metric_summary(name, since_seconds)
        
        # Group by category
        categorized = defaultdict(dict)
        for name, summary in summaries.items():
            category = summary.get('category', 'unknown')
            categorized[category][name] = summary
        
        return {
            'timespan_hours': since_hours,
            'total_metrics': len(summaries),
            'categories': dict(categorized),
            'system_info': self._get_system_info()
        }
    
    def get_benchmark_summary(self, since_hours: int = 24) -> Dict[str, Any]:
        """Get benchmark results summary."""
        cutoff_time = time.time() - (since_hours * 3600)
        recent_benchmarks = [b for b in self.benchmarks if b.timestamp >= cutoff_time]
        
        if not recent_benchmarks:
            return {
                'timespan_hours': since_hours,
                'total_benchmarks': 0,
                'successful_benchmarks': 0,
                'failed_benchmarks': 0,
                'benchmarks': []
            }
        
        successful = [b for b in recent_benchmarks if b.success]
        failed = [b for b in recent_benchmarks if not b.success]
        
        # Group by benchmark name
        by_name = defaultdict(list)
        for benchmark in recent_benchmarks:
            by_name[benchmark.benchmark_name].append(benchmark)
        
        # Calculate averages per benchmark
        benchmark_stats = {}
        for name, benchmarks in by_name.items():
            successful_benchmarks = [b for b in benchmarks if b.success]
            if successful_benchmarks:
                durations = [b.duration_ms for b in successful_benchmarks]
                ops_per_sec = [b.operations_per_second for b in successful_benchmarks]
                
                benchmark_stats[name] = {
                    'count': len(benchmarks),
                    'successful': len(successful_benchmarks),
                    'failed': len(benchmarks) - len(successful_benchmarks),
                    'avg_duration_ms': statistics.mean(durations),
                    'min_duration_ms': min(durations),
                    'max_duration_ms': max(durations),
                    'avg_ops_per_sec': statistics.mean(ops_per_sec),
                    'latest_result': successful_benchmarks[-1].to_dict()
                }
        
        return {
            'timespan_hours': since_hours,
            'total_benchmarks': len(recent_benchmarks),
            'successful_benchmarks': len(successful),
            'failed_benchmarks': len(failed),
            'benchmark_stats': benchmark_stats,
            'recent_failures': [b.to_dict() for b in failed[-10:]]  # Last 10 failures
        }
    
    def get_performance_dashboard(self) -> Dict[str, Any]:
        """Get real-time performance dashboard data."""
        return {
            'system_metrics': self._get_current_system_metrics(),
            'recent_metrics': self.get_metrics_summary(since_hours=1),
            'recent_benchmarks': self.get_benchmark_summary(since_hours=1),
            'alerts': self._get_recent_alerts(),
            'health_status': self._get_health_status(),
            'timestamp': time.time()
        }
    
    def add_alert_callback(self, callback: Callable[[Dict[str, Any]], None]) -> None:
        """Add an alert callback for threshold violations."""
        self.alert_callbacks.append(callback)
    
    def remove_alert_callback(self, callback: Callable[[Dict[str, Any]], None]) -> None:
        """Remove an alert callback."""
        if callback in self.alert_callbacks:
            self.alert_callbacks.remove(callback)
    
    async def _monitor_system_metrics(self) -> None:
        """Background task to monitor system metrics."""
        while self.running:
            try:
                # Collect system metrics
                cpu_percent = psutil.cpu_percent()
                memory = psutil.virtual_memory()
                disk = psutil.disk_usage('/')
                
                # Record metrics
                await self.record_metric("system_cpu_usage", cpu_percent, "percent", "system")
                await self.record_metric("system_memory_usage", memory.percent, "percent", "system")
                await self.record_metric("system_memory_available", memory.available / 1024 / 1024, "MB", "system")
                await self.record_metric("system_disk_usage", disk.percent, "percent", "system")
                
                # Network I/O if available
                try:
                    network = psutil.net_io_counters()
                    await self.record_metric("network_bytes_sent", network.bytes_sent, "bytes", "network")
                    await self.record_metric("network_bytes_recv", network.bytes_recv, "bytes", "network")
                except Exception:
                    pass  # Network monitoring is optional
                
                # Sleep before next collection
                await asyncio.sleep(30)  # Collect every 30 seconds
                
            except Exception as e:
                logger.error(f"Error in system metrics monitoring: {e}")
                await asyncio.sleep(60)  # Wait longer on error
    
    def _get_system_info(self) -> Dict[str, Any]:
        """Get static system information."""
        return {
            'cpu_count': psutil.cpu_count(),
            'memory_total_gb': psutil.virtual_memory().total / 1024 / 1024 / 1024,
            'disk_total_gb': psutil.disk_usage('/').total / 1024 / 1024 / 1024,
            'platform': psutil.os.name,
            'python_version': psutil.sys.version
        }
    
    def _get_current_system_metrics(self) -> Dict[str, Any]:
        """Get current system metrics snapshot."""
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        return {
            'cpu_percent': psutil.cpu_percent(),
            'memory_percent': memory.percent,
            'memory_available_gb': memory.available / 1024 / 1024 / 1024,
            'disk_percent': disk.percent,
            'disk_free_gb': disk.free / 1024 / 1024 / 1024,
            'timestamp': time.time()
        }
    
    async def _check_thresholds(self, metric: PerformanceMetric) -> None:
        """Check if metric exceeds thresholds and trigger alerts."""
        threshold_key = metric.name
        if threshold_key in self.thresholds:
            threshold = self.thresholds[threshold_key]
            
            if metric.value > threshold:
                alert = {
                    'type': 'threshold_exceeded',
                    'metric': metric.to_dict(),
                    'threshold': threshold,
                    'severity': 'warning' if metric.value < threshold * 1.5 else 'critical',
                    'timestamp': time.time()
                }
                
                logger.warning(f"Performance threshold exceeded: {metric.name} = {metric.value} > {threshold}")
                
                # Notify callbacks
                for callback in self.alert_callbacks:
                    try:
                        if asyncio.iscoroutinefunction(callback):
                            await callback(alert)
                        else:
                            callback(alert)
                    except Exception as e:
                        logger.error(f"Error in alert callback: {e}")
    
    def _get_recent_alerts(self, since_minutes: int = 60) -> List[Dict[str, Any]]:
        """Get recent alerts (placeholder for alert storage)."""
        # This would be implemented with proper alert storage
        return []
    
    def _get_health_status(self) -> Dict[str, Any]:
        """Get overall system health status."""
        current_metrics = self._get_current_system_metrics()
        
        status = "healthy"
        issues = []
        
        # Check critical thresholds
        if current_metrics['cpu_percent'] > 90:
            status = "warning"
            issues.append("High CPU usage")
        
        if current_metrics['memory_percent'] > 90:
            status = "critical"
            issues.append("High memory usage")
        
        if current_metrics['disk_percent'] > 95:
            status = "critical"
            issues.append("Low disk space")
        
        return {
            'status': status,
            'issues': issues,
            'last_check': time.time()
        }
    
    async def _load_historical_data(self) -> None:
        """Load historical performance data."""
        try:
            benchmarks_file = self.data_dir / "benchmarks.json"
            if benchmarks_file.exists():
                with open(benchmarks_file, 'r') as f:
                    data = json.load(f)
                    self.benchmarks = [BenchmarkResult(**item) for item in data]
                    logger.info(f"Loaded {len(self.benchmarks)} historical benchmarks")
        except Exception as e:
            logger.warning(f"Failed to load historical data: {e}")
    
    async def _save_historical_data(self) -> None:
        """Save historical performance data."""
        try:
            benchmarks_file = self.data_dir / "benchmarks.json"
            with open(benchmarks_file, 'w') as f:
                data = [b.to_dict() for b in self.benchmarks[-1000:]]  # Keep last 1000
                json.dump(data, f, indent=2)
                logger.info(f"Saved {len(data)} benchmarks to historical data")
        except Exception as e:
            logger.error(f"Failed to save historical data: {e}")


# Global instance
performance_monitor: Optional[PerformanceMonitor] = None


def get_performance_monitor() -> PerformanceMonitor:
    """Get the global performance monitor instance."""
    global performance_monitor
    if performance_monitor is None:
        performance_monitor = PerformanceMonitor()
    return performance_monitor


@asynccontextmanager
async def performance_timer(name: str, category: str = "operation"):
    """Async context manager for performance timing."""
    monitor = get_performance_monitor()
    with monitor.timer(name, category) as timer:
        yield timer