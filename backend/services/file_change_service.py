"""
File Change Detection Service - Real-time file monitoring for vault updates.
Provides file system watching, change detection, and incremental update triggering.
"""
import asyncio
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional, Callable
import json
import time
from dataclasses import dataclass, asdict
from concurrent.futures import ThreadPoolExecutor

try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler, FileSystemEvent
    WATCHDOG_AVAILABLE = True
except ImportError:
    WATCHDOG_AVAILABLE = False
    Observer = None
    FileSystemEventHandler = None
    FileSystemEvent = None

from indexer.file_tracker import FileChangeTracker

logger = logging.getLogger(__name__)


@dataclass
class FileChangeEvent:
    """Represents a file change event."""
    file_path: str
    event_type: str  # 'created', 'modified', 'deleted', 'moved'
    timestamp: float
    vault_name: str
    old_path: Optional[str] = None  # For move events
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class VaultWatchConfig:
    """Configuration for watching a vault."""
    vault_name: str
    vault_path: str
    enabled: bool = True
    check_interval: int = 300  # seconds
    debounce_delay: float = 2.0  # seconds to wait before processing changes
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class VaultFileSystemHandler(FileSystemEventHandler):
    """File system event handler for a specific vault."""
    
    def __init__(self, vault_name: str, change_service: 'FileChangeService'):
        self.vault_name = vault_name
        self.change_service = change_service
        self.supported_extensions = {'.md', '.txt'}
        self.excluded_folders = {'.obsidian', '.trash', 'templates'}
    
    def _should_process_file(self, file_path: str) -> bool:
        """Check if file should be processed."""
        path = Path(file_path)
        
        # Check extension
        if path.suffix not in self.supported_extensions:
            return False
        
        # Check for excluded folders
        for part in path.parts:
            if part in self.excluded_folders:
                return False
        
        return True
    
    def on_created(self, event: FileSystemEvent):
        if not event.is_directory and self._should_process_file(event.src_path):
            self.change_service._queue_change_event(
                FileChangeEvent(
                    file_path=event.src_path,
                    event_type='created',
                    timestamp=time.time(),
                    vault_name=self.vault_name
                )
            )
    
    def on_modified(self, event: FileSystemEvent):
        if not event.is_directory and self._should_process_file(event.src_path):
            self.change_service._queue_change_event(
                FileChangeEvent(
                    file_path=event.src_path,
                    event_type='modified',
                    timestamp=time.time(),
                    vault_name=self.vault_name
                )
            )
    
    def on_deleted(self, event: FileSystemEvent):
        if not event.is_directory and self._should_process_file(event.src_path):
            self.change_service._queue_change_event(
                FileChangeEvent(
                    file_path=event.src_path,
                    event_type='deleted',
                    timestamp=time.time(),
                    vault_name=self.vault_name
                )
            )
    
    def on_moved(self, event: FileSystemEvent):
        if not event.is_directory:
            if self._should_process_file(event.src_path) or self._should_process_file(event.dest_path):
                self.change_service._queue_change_event(
                    FileChangeEvent(
                        file_path=event.dest_path,
                        event_type='moved',
                        timestamp=time.time(),
                        vault_name=self.vault_name,
                        old_path=event.src_path
                    )
                )


class FileChangeService:
    """Service for detecting and managing file changes in vaults."""
    
    def __init__(self, state_dir: str = "./file_change_state"):
        """Initialize the file change service."""
        self.state_dir = Path(state_dir)
        self.state_dir.mkdir(exist_ok=True)
        
        # Core components
        self.file_tracker = FileChangeTracker()
        
        # Vault configurations
        self.vault_configs: Dict[str, VaultWatchConfig] = {}
        
        # Real-time watching (if available)
        self.observers: Dict[str, Observer] = {} if WATCHDOG_AVAILABLE else {}
        self.handlers: Dict[str, VaultFileSystemHandler] = {}
        
        # Event processing
        self.event_queue: asyncio.Queue = asyncio.Queue()
        self.debounced_events: Dict[str, FileChangeEvent] = {}
        self.event_callbacks: List[Callable[[List[FileChangeEvent]], None]] = []
        
        # Background tasks
        self.running = False
        self.tasks: List[asyncio.Task] = []
        self.executor = ThreadPoolExecutor(max_workers=2)
        
        # Statistics
        self.stats = {
            'events_processed': 0,
            'last_scan_time': None,
            'active_watchers': 0,
            'total_files_tracked': 0
        }
    
    async def start(self):
        """Start the file change service."""
        if self.running:
            return
        
        self.running = True
        logger.info("Starting file change service")
        
        # Load existing configurations
        await self._load_configurations()
        
        # Start background tasks
        self.tasks = [
            asyncio.create_task(self._process_events()),
            asyncio.create_task(self._periodic_scan()),
            asyncio.create_task(self._cleanup_debounced_events())
        ]
        
        # Start watchers for configured vaults
        await self._start_all_watchers()
        
        logger.info(f"File change service started with {len(self.vault_configs)} vault configurations")
    
    async def stop(self):
        """Stop the file change service."""
        if not self.running:
            return
        
        self.running = False
        logger.info("Stopping file change service")
        
        # Stop all watchers
        await self._stop_all_watchers()
        
        # Cancel background tasks
        for task in self.tasks:
            task.cancel()
        
        await asyncio.gather(*self.tasks, return_exceptions=True)
        self.tasks.clear()
        
        # Shutdown executor
        self.executor.shutdown(wait=True)
        
        # Save configurations
        await self._save_configurations()
        
        logger.info("File change service stopped")
    
    async def add_vault_watch(self, vault_name: str, vault_path: str, **kwargs) -> None:
        """Add a vault to the watch list."""
        config = VaultWatchConfig(
            vault_name=vault_name,
            vault_path=vault_path,
            **kwargs
        )
        
        self.vault_configs[vault_name] = config
        
        if self.running and config.enabled:
            await self._start_vault_watcher(vault_name, config)
        
        await self._save_configurations()
        logger.info(f"Added vault watch: {vault_name} -> {vault_path}")
    
    async def remove_vault_watch(self, vault_name: str) -> None:
        """Remove a vault from the watch list."""
        if vault_name in self.vault_configs:
            await self._stop_vault_watcher(vault_name)
            del self.vault_configs[vault_name]
            await self._save_configurations()
            logger.info(f"Removed vault watch: {vault_name}")
    
    async def enable_vault_watch(self, vault_name: str, enabled: bool = True) -> None:
        """Enable or disable watching for a vault."""
        if vault_name in self.vault_configs:
            self.vault_configs[vault_name].enabled = enabled
            
            if self.running:
                if enabled:
                    await self._start_vault_watcher(vault_name, self.vault_configs[vault_name])
                else:
                    await self._stop_vault_watcher(vault_name)
            
            await self._save_configurations()
            logger.info(f"{'Enabled' if enabled else 'Disabled'} vault watch: {vault_name}")
    
    async def scan_vault_changes(self, vault_name: str) -> Dict[str, List[str]]:
        """Manually scan a vault for changes."""
        if vault_name not in self.vault_configs:
            raise ValueError(f"Vault '{vault_name}' is not configured for watching")
        
        config = self.vault_configs[vault_name]
        vault_path = Path(config.vault_path)
        
        if not vault_path.exists():
            raise ValueError(f"Vault path does not exist: {config.vault_path}")
        
        # Load previous state for this vault
        state_file = self.state_dir / f"{vault_name}_state.json"
        self.file_tracker.load_state(state_file)
        
        # Scan for changes
        changes = self.file_tracker.scan_vault(vault_path)
        
        # Save updated state
        self.file_tracker.save_state(state_file)
        
        # Update statistics
        self.stats['last_scan_time'] = time.time()
        self.stats['total_files_tracked'] = len(self.file_tracker._file_states)
        
        logger.info(f"Scanned {vault_name}: {len(changes['added'])} added, "
                   f"{len(changes['modified'])} modified, {len(changes['deleted'])} deleted")
        
        return changes
    
    def add_change_callback(self, callback: Callable[[List[FileChangeEvent]], None]) -> None:
        """Add a callback for file change events."""
        self.event_callbacks.append(callback)
    
    def remove_change_callback(self, callback: Callable[[List[FileChangeEvent]], None]) -> None:
        """Remove a callback for file change events."""
        if callback in self.event_callbacks:
            self.event_callbacks.remove(callback)
    
    def get_vault_configs(self) -> Dict[str, Dict[str, Any]]:
        """Get all vault configurations."""
        return {name: config.to_dict() for name, config in self.vault_configs.items()}
    
    def get_service_stats(self) -> Dict[str, Any]:
        """Get service statistics."""
        return {
            **self.stats,
            'active_watchers': len(self.observers),
            'configured_vaults': len(self.vault_configs),
            'queue_size': self.event_queue.qsize(),
            'debounced_events': len(self.debounced_events),
            'watchdog_available': WATCHDOG_AVAILABLE
        }
    
    def _queue_change_event(self, event: FileChangeEvent) -> None:
        """Queue a file change event for processing."""
        if not self.running:
            return
        
        # Put event in queue (non-blocking)
        try:
            self.event_queue.put_nowait(event)
        except asyncio.QueueFull:
            logger.warning("Event queue is full, dropping event")
    
    async def _process_events(self):
        """Background task to process file change events."""
        while self.running:
            try:
                # Wait for events with timeout
                event = await asyncio.wait_for(self.event_queue.get(), timeout=1.0)
                
                # Debounce events (group rapid changes to same file)
                event_key = f"{event.vault_name}:{event.file_path}"
                self.debounced_events[event_key] = event
                
                self.stats['events_processed'] += 1
                
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Error processing file change event: {e}")
    
    async def _cleanup_debounced_events(self):
        """Background task to process debounced events."""
        while self.running:
            try:
                await asyncio.sleep(1.0)  # Check every second
                
                current_time = time.time()
                ready_events = []
                
                # Find events ready for processing
                for key, event in list(self.debounced_events.items()):
                    vault_config = self.vault_configs.get(event.vault_name)
                    if not vault_config:
                        continue
                    
                    debounce_delay = vault_config.debounce_delay
                    if current_time - event.timestamp >= debounce_delay:
                        ready_events.append(event)
                        del self.debounced_events[key]
                
                # Process ready events
                if ready_events:
                    await self._notify_callbacks(ready_events)
                
            except Exception as e:
                logger.error(f"Error in debounced event cleanup: {e}")
    
    async def _notify_callbacks(self, events: List[FileChangeEvent]):
        """Notify all callbacks of file change events."""
        for callback in self.event_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(events)
                else:
                    # Run sync callback in executor
                    await asyncio.get_event_loop().run_in_executor(
                        self.executor, callback, events
                    )
            except Exception as e:
                logger.error(f"Error in change callback: {e}")
    
    async def _periodic_scan(self):
        """Background task for periodic vault scanning."""
        while self.running:
            try:
                await asyncio.sleep(60)  # Check every minute
                
                current_time = time.time()
                
                for vault_name, config in self.vault_configs.items():
                    if not config.enabled:
                        continue
                    
                    # Check if it's time for a periodic scan
                    last_scan = self.stats.get('last_scan_time', 0)
                    if current_time - last_scan >= config.check_interval:
                        try:
                            changes = await self.scan_vault_changes(vault_name)
                            
                            # Create events for detected changes
                            events = []
                            for event_type, file_paths in changes.items():
                                for file_path in file_paths:
                                    events.append(FileChangeEvent(
                                        file_path=file_path,
                                        event_type=event_type,
                                        timestamp=current_time,
                                        vault_name=vault_name
                                    ))
                            
                            if events:
                                await self._notify_callbacks(events)
                                
                        except Exception as e:
                            logger.error(f"Error in periodic scan for {vault_name}: {e}")
                
            except Exception as e:
                logger.error(f"Error in periodic scan task: {e}")
    
    async def _start_all_watchers(self):
        """Start all configured vault watchers."""
        for vault_name, config in self.vault_configs.items():
            if config.enabled:
                await self._start_vault_watcher(vault_name, config)
    
    async def _stop_all_watchers(self):
        """Stop all vault watchers."""
        for vault_name in list(self.observers.keys()):
            await self._stop_vault_watcher(vault_name)
    
    async def _start_vault_watcher(self, vault_name: str, config: VaultWatchConfig):
        """Start watching a specific vault."""
        if not WATCHDOG_AVAILABLE:
            logger.warning(f"Watchdog not available, skipping real-time watching for {vault_name}")
            return
        
        vault_path = Path(config.vault_path)
        if not vault_path.exists():
            logger.warning(f"Cannot watch {vault_name}: path does not exist: {config.vault_path}")
            return
        
        # Stop existing watcher if any
        await self._stop_vault_watcher(vault_name)
        
        try:
            # Create handler and observer
            handler = VaultFileSystemHandler(vault_name, self)
            observer = Observer()
            
            observer.schedule(handler, str(vault_path), recursive=True)
            observer.start()
            
            self.handlers[vault_name] = handler
            self.observers[vault_name] = observer
            
            logger.info(f"Started file watcher for vault: {vault_name}")
            
        except Exception as e:
            logger.error(f"Failed to start watcher for {vault_name}: {e}")
    
    async def _stop_vault_watcher(self, vault_name: str):
        """Stop watching a specific vault."""
        if vault_name in self.observers:
            try:
                observer = self.observers[vault_name]
                observer.stop()
                observer.join(timeout=5.0)
                del self.observers[vault_name]
                
                if vault_name in self.handlers:
                    del self.handlers[vault_name]
                
                logger.info(f"Stopped file watcher for vault: {vault_name}")
                
            except Exception as e:
                logger.error(f"Error stopping watcher for {vault_name}: {e}")
    
    async def _load_configurations(self):
        """Load vault configurations from disk."""
        config_file = self.state_dir / "vault_configs.json"
        
        if not config_file.exists():
            return
        
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            for vault_name, config_data in data.items():
                self.vault_configs[vault_name] = VaultWatchConfig(**config_data)
            
            logger.info(f"Loaded {len(self.vault_configs)} vault configurations")
            
        except Exception as e:
            logger.error(f"Failed to load vault configurations: {e}")
    
    async def _save_configurations(self):
        """Save vault configurations to disk."""
        config_file = self.state_dir / "vault_configs.json"
        
        try:
            data = {name: config.to_dict() for name, config in self.vault_configs.items()}
            
            with open(config_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2)
            
        except Exception as e:
            logger.error(f"Failed to save vault configurations: {e}")


# Global instance
file_change_service: Optional[FileChangeService] = None


def get_file_change_service() -> FileChangeService:
    """Get the global file change service instance."""
    global file_change_service
    if file_change_service is None:
        file_change_service = FileChangeService()
    return file_change_service