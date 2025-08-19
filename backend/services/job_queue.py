"""
Job Queue System for background task management in Vault Mind.
Handles indexing jobs, progress tracking, and concurrent operation limits.
"""
import asyncio
import json
import logging
import sqlite3
import uuid
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime

from config.config import config

logger = logging.getLogger(__name__)


class JobStatus(Enum):
    """Job execution status enumeration."""
    PENDING = "pending"
    QUEUED = "queued"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class Job:
    """Job data structure for queue management."""
    id: str
    job_type: str
    collection_name: str
    status: JobStatus
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    progress_data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    priority: int = 0  # Higher number = higher priority


class JobQueue:
    """
    Manages background jobs with SQLite persistence and concurrent execution limits.
    
    Features:
    - Persistent job storage with SQLite
    - Concurrent execution limits (max 3 indexing jobs)
    - Priority-based job scheduling
    - Progress tracking and error handling
    - Job cancellation and pause/resume functionality
    - WebSocket integration for real-time updates
    """
    
    def __init__(self, max_concurrent_jobs: int = 3):
        self.max_concurrent_jobs = max_concurrent_jobs
        self.settings = config
        
        # Job database storage
        self.db_path = Path(self.settings.chroma_persist_dir) / "jobs.db"
        self._init_job_db()
        
        # In-memory job tracking
        self.active_jobs: Dict[str, Job] = {}
        self.job_handlers: Dict[str, Callable] = {}
        self.running_tasks: Dict[str, asyncio.Task] = {}
        
        # Job execution lock
        self._queue_lock = asyncio.Lock()
        
        # Background queue processor
        self._queue_processor_task = None
        self._shutdown_event = asyncio.Event()
        
    def _init_job_db(self):
        """Initialize SQLite database for job persistence."""
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY,
                    job_type TEXT NOT NULL,
                    collection_name TEXT,
                    status TEXT NOT NULL,
                    priority INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    started_at TIMESTAMP,
                    completed_at TIMESTAMP,
                    progress_data TEXT,
                    error_message TEXT,
                    data TEXT,
                    retry_count INTEGER DEFAULT 0,
                    max_retries INTEGER DEFAULT 3
                )
            """)
            
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
            """)
            
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_jobs_collection ON jobs(collection_name);
            """)
            
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_jobs_priority ON jobs(priority DESC, created_at ASC);
            """)
            
            conn.commit()

    async def start_queue_processor(self):
        """Start the background queue processor."""
        if self._queue_processor_task is None or self._queue_processor_task.done():
            self._queue_processor_task = asyncio.create_task(self._queue_processor())
            logger.info("Job queue processor started")

    async def stop_queue_processor(self):
        """Stop the background queue processor gracefully."""
        if self._queue_processor_task:
            self._shutdown_event.set()
            await self._queue_processor_task
            logger.info("Job queue processor stopped")

    async def create_job(
        self,
        job_type: str,
        collection_name: str,
        data: Optional[Dict[str, Any]] = None,
        priority: int = 0
    ) -> str:
        """
        Create a new job and add it to the queue.
        
        Args:
            job_type: Type of job (create_collection, reindex_collection, etc.)
            collection_name: Target collection name
            data: Job-specific data
            priority: Job priority (higher = more urgent)
            
        Returns:
            Job ID for tracking
        """
        job_id = str(uuid.uuid4())
        now = datetime.utcnow()
        
        job = Job(
            id=job_id,
            job_type=job_type,
            collection_name=collection_name,
            status=JobStatus.PENDING,
            created_at=now,
            data=data or {},
            priority=priority
        )
        
        # Persist job to database
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                INSERT INTO jobs (id, job_type, collection_name, status, priority, 
                                created_at, data)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                job.id, job.job_type, job.collection_name, job.status.value,
                job.priority, job.created_at.isoformat(), json.dumps(job.data)
            ))
            conn.commit()
        
        # Add to active jobs
        self.active_jobs[job_id] = job
        
        logger.info(f"Job created: {job_id} ({job_type}) for collection: {collection_name}")
        
        # Trigger queue processing
        if not self._queue_processor_task or self._queue_processor_task.done():
            await self.start_queue_processor()
        
        return job_id

    async def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """
        Get current status of a job.
        
        Args:
            job_id: Job identifier
            
        Returns:
            Job status data or None if not found
        """
        # Check in-memory first
        if job_id in self.active_jobs:
            job = self.active_jobs[job_id]
            return self._job_to_dict(job)
        
        # Check database
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute(
                "SELECT * FROM jobs WHERE id = ?",
                (job_id,)
            ).fetchone()
            
            if row:
                return {
                    "job_id": row['id'],
                    "job_type": row['job_type'],
                    "collection_name": row['collection_name'],
                    "status": row['status'],
                    "priority": row['priority'],
                    "created_at": row['created_at'],
                    "started_at": row['started_at'],
                    "completed_at": row['completed_at'],
                    "progress_data": json.loads(row['progress_data']) if row['progress_data'] else None,
                    "error_message": row['error_message'],
                    "data": json.loads(row['data']) if row['data'] else None,
                    "retry_count": row['retry_count']
                }
        
        return None

    async def update_job_progress(
        self,
        job_id: str,
        progress_data: Dict[str, Any],
        status: Optional[JobStatus] = None
    ):
        """
        Update job progress and optionally status.
        
        Args:
            job_id: Job identifier
            progress_data: Progress information
            status: New job status (optional)
        """
        if job_id in self.active_jobs:
            job = self.active_jobs[job_id]
            job.progress_data = progress_data
            
            if status:
                job.status = status
                if status == JobStatus.RUNNING and not job.started_at:
                    job.started_at = datetime.utcnow()
                elif status in [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED]:
                    job.completed_at = datetime.utcnow()
            
            # Update database
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    UPDATE jobs 
                    SET progress_data = ?, status = ?, started_at = ?, completed_at = ?
                    WHERE id = ?
                """, (
                    json.dumps(progress_data),
                    job.status.value,
                    job.started_at.isoformat() if job.started_at else None,
                    job.completed_at.isoformat() if job.completed_at else None,
                    job_id
                ))
                conn.commit()
            
            # Broadcast progress update via WebSocket if available
            await self._broadcast_progress_update(job)
            
            logger.debug(f"Job progress updated: {job_id} - {progress_data}")

    async def cancel_job(self, job_id: str) -> bool:
        """
        Cancel a job (pending, queued, or running).
        
        Args:
            job_id: Job identifier
            
        Returns:
            True if cancelled successfully
        """
        if job_id not in self.active_jobs:
            return False
        
        job = self.active_jobs[job_id]
        
        if job.status in [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED]:
            return False
        
        # Cancel running task if exists
        if job_id in self.running_tasks:
            task = self.running_tasks[job_id]
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
            del self.running_tasks[job_id]
        
        # Update job status
        job.status = JobStatus.CANCELLED
        job.completed_at = datetime.utcnow()
        
        # Update database
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                UPDATE jobs SET status = ?, completed_at = ? WHERE id = ?
            """, (job.status.value, job.completed_at.isoformat(), job_id))
            conn.commit()
        
        logger.info(f"Job cancelled: {job_id}")
        return True

    async def pause_job(self, job_id: str) -> bool:
        """
        Pause a running job.
        
        Args:
            job_id: Job identifier
            
        Returns:
            True if paused successfully
        """
        if job_id not in self.active_jobs:
            return False
        
        job = self.active_jobs[job_id]
        
        if job.status != JobStatus.RUNNING:
            return False
        
        # Signal pause to running task (implementation-specific)
        if job_id in self.running_tasks:
            # Set pause flag in job data
            job.data = job.data or {}
            job.data['paused'] = True
        
        job.status = JobStatus.PAUSED
        
        # Update database
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                UPDATE jobs SET status = ?, data = ? WHERE id = ?
            """, (job.status.value, json.dumps(job.data), job_id))
            conn.commit()
        
        logger.info(f"Job paused: {job_id}")
        return True

    async def resume_job(self, job_id: str) -> bool:
        """
        Resume a paused job.
        
        Args:
            job_id: Job identifier
            
        Returns:
            True if resumed successfully
        """
        if job_id not in self.active_jobs:
            return False
        
        job = self.active_jobs[job_id]
        
        if job.status != JobStatus.PAUSED:
            return False
        
        # Remove pause flag
        if job.data and 'paused' in job.data:
            del job.data['paused']
        
        job.status = JobStatus.QUEUED
        
        # Update database
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                UPDATE jobs SET status = ?, data = ? WHERE id = ?
            """, (job.status.value, json.dumps(job.data), job_id))
            conn.commit()
        
        logger.info(f"Job resumed: {job_id}")
        return True

    async def get_collection_jobs(self, collection_name: str, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Get all jobs for a specific collection.
        
        Args:
            collection_name: Target collection
            limit: Maximum number of jobs to return
            
        Returns:
            List of job data
        """
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute("""
                SELECT * FROM jobs 
                WHERE collection_name = ? 
                ORDER BY created_at DESC 
                LIMIT ?
            """, (collection_name, limit)).fetchall()
            
            return [
                {
                    "job_id": row['id'],
                    "job_type": row['job_type'],
                    "status": row['status'],
                    "created_at": row['created_at'],
                    "started_at": row['started_at'],
                    "completed_at": row['completed_at'],
                    "progress_data": json.loads(row['progress_data']) if row['progress_data'] else None,
                    "error_message": row['error_message']
                }
                for row in rows
            ]

    async def get_active_job_for_collection(self, collection_name: str) -> Optional[Dict[str, Any]]:
        """
        Get active job (if any) for a collection.
        
        Args:
            collection_name: Target collection
            
        Returns:
            Active job data or None
        """
        for job in self.active_jobs.values():
            if (job.collection_name == collection_name and 
                job.status in [JobStatus.PENDING, JobStatus.QUEUED, JobStatus.RUNNING, JobStatus.PAUSED]):
                return self._job_to_dict(job)
        return None

    async def get_queue_stats(self) -> Dict[str, Any]:
        """
        Get queue statistics.
        
        Returns:
            Queue statistics
        """
        with sqlite3.connect(self.db_path) as conn:
            stats = {}
            
            # Count by status
            rows = conn.execute("""
                SELECT status, COUNT(*) as count FROM jobs GROUP BY status
            """).fetchall()
            
            for status, count in rows:
                stats[f"{status}_jobs"] = count
            
            # Active jobs count
            stats["active_jobs"] = len([j for j in self.active_jobs.values() 
                                     if j.status in [JobStatus.RUNNING, JobStatus.QUEUED]])
            
            # Queue capacity
            stats["max_concurrent_jobs"] = self.max_concurrent_jobs
            stats["available_slots"] = max(0, self.max_concurrent_jobs - 
                                         len([j for j in self.active_jobs.values() 
                                            if j.status == JobStatus.RUNNING]))
            
            return stats

    async def _queue_processor(self):
        """Background task that processes the job queue."""
        logger.info("Job queue processor started")
        
        while not self._shutdown_event.is_set():
            try:
                await self._process_next_jobs()
                await asyncio.sleep(1)  # Check every second
            except Exception as e:
                logger.error(f"Error in queue processor: {str(e)}", exc_info=True)
                await asyncio.sleep(5)  # Wait before retrying
        
        logger.info("Job queue processor stopped")

    async def _process_next_jobs(self):
        """Process next jobs in the queue if slots available."""
        async with self._queue_lock:
            # Count running jobs
            running_jobs = len([j for j in self.active_jobs.values() 
                              if j.status == JobStatus.RUNNING])
            
            if running_jobs >= self.max_concurrent_jobs:
                return
            
            # Get next pending jobs
            available_slots = self.max_concurrent_jobs - running_jobs
            next_jobs = await self._get_next_jobs(available_slots)
            
            for job in next_jobs:
                await self._start_job_execution(job)

    async def _get_next_jobs(self, limit: int) -> List[Job]:
        """Get next jobs to execute based on priority and creation time."""
        # Get pending jobs from database
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute("""
                SELECT * FROM jobs 
                WHERE status IN ('pending', 'queued')
                ORDER BY priority DESC, created_at ASC
                LIMIT ?
            """, (limit,)).fetchall()
            
            jobs = []
            for row in rows:
                job = Job(
                    id=row['id'],
                    job_type=row['job_type'],
                    collection_name=row['collection_name'],
                    status=JobStatus(row['status']),
                    created_at=datetime.fromisoformat(row['created_at']),
                    data=json.loads(row['data']) if row['data'] else None,
                    priority=row['priority']
                )
                jobs.append(job)
                self.active_jobs[job.id] = job
            
            return jobs

    async def _start_job_execution(self, job: Job):
        """Start executing a job."""
        job.status = JobStatus.RUNNING
        job.started_at = datetime.utcnow()
        
        # Update database
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                UPDATE jobs SET status = ?, started_at = ? WHERE id = ?
            """, (job.status.value, job.started_at.isoformat(), job.id))
            conn.commit()
        
        # Create and start execution task
        task = asyncio.create_task(self._execute_job(job))
        self.running_tasks[job.id] = task
        
        logger.info(f"Job execution started: {job.id} ({job.job_type})")

    async def _execute_job(self, job: Job):
        """Execute a job based on its type."""
        try:
            # Get job handler
            handler = self.job_handlers.get(job.job_type)
            if not handler:
                raise ValueError(f"No handler registered for job type: {job.job_type}")
            
            # Execute job
            await handler(job)
            
            # Mark as completed
            job.status = JobStatus.COMPLETED
            job.completed_at = datetime.utcnow()
            
        except asyncio.CancelledError:
            job.status = JobStatus.CANCELLED
            job.completed_at = datetime.utcnow()
            logger.info(f"Job cancelled: {job.id}")
            
        except Exception as e:
            job.status = JobStatus.FAILED
            job.completed_at = datetime.utcnow()
            job.error_message = str(e)
            logger.error(f"Job failed: {job.id} - {str(e)}", exc_info=True)
        
        finally:
            # Update database
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    UPDATE jobs 
                    SET status = ?, completed_at = ?, error_message = ?
                    WHERE id = ?
                """, (
                    job.status.value,
                    job.completed_at.isoformat() if job.completed_at else None,
                    job.error_message,
                    job.id
                ))
                conn.commit()
            
            # Clean up
            if job.id in self.running_tasks:
                del self.running_tasks[job.id]
            
            logger.info(f"Job execution finished: {job.id} - {job.status.value}")

    def register_job_handler(self, job_type: str, handler: Callable):
        """Register a handler function for a job type."""
        self.job_handlers[job_type] = handler
        logger.info(f"Job handler registered: {job_type}")

    def _job_to_dict(self, job: Job) -> Dict[str, Any]:
        """Convert Job object to dictionary."""
        return {
            "job_id": job.id,
            "job_type": job.job_type,
            "collection_name": job.collection_name,
            "status": job.status.value,
            "priority": job.priority,
            "created_at": job.created_at.isoformat(),
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
            "progress_data": job.progress_data,
            "error_message": job.error_message,
            "data": job.data
        }

    async def _broadcast_progress_update(self, job: Job):
        """Broadcast progress update via WebSocket (if available)."""
        try:
            # Import here to avoid circular dependency
            from api.routes.collections_ws import broadcast_progress_update
            
            if job.progress_data:
                await broadcast_progress_update(job.collection_name, job.progress_data)
                
        except ImportError:
            # WebSocket not available
            pass
        except Exception as e:
            logger.warning(f"Failed to broadcast progress update: {str(e)}")