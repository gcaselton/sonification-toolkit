import shutil
import time
import asyncio
from datetime import datetime
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class StorageManager:
    """Manages cleanup of session directories with multiple policies."""
    
    def __init__(
        self,
        target_dir: Path,
        max_age_days: int = 7,
        disk_threshold_percent: float = 70.0,
        cleanup_interval_hours: int = 6,
        emergency_threshold_percent: float = 80.0,
        min_free_gb: float = 2.0
    ):
        """
        Initialize cleanup manager.
        
        Args:
            target_dir: Base directory containing session folders
            max_age_days: Max age in days before session is deleted
            disk_threshold_percent: Disk usage % that triggers cleanup
            cleanup_interval_hours: Hours between scheduled cleanups
            emergency_threshold_percent: Critical disk usage for aggressive cleanup
            min_free_gb: Minimum free space to maintain (GB)
        """
        self.target_dir = target_dir
        self.max_age_seconds = max_age_days * 24 * 60 * 60
        self.disk_threshold = disk_threshold_percent
        self.cleanup_interval = cleanup_interval_hours * 3600
        self.emergency_threshold = emergency_threshold_percent
        self.min_free_bytes = min_free_gb * 1024**3
        
        # Ensure base directory exists
        self.target_dir.mkdir(parents=True, exist_ok=True)
    
    def get_disk_usage(self) -> tuple[float, float, float]:
        """
        Get disk usage statistics.
        
        Returns:
            Tuple of (used_percent, used_gb, free_gb)
        """
        stat = shutil.disk_usage(self.target_dir)
        used_percent = (stat.used / stat.total) * 100
        used_gb = stat.used / (1024**3)
        free_gb = stat.free / (1024**3)
        return used_percent, used_gb, free_gb
    
    def get_session_dirs(self) -> list[tuple[Path, float]]:
        """
        Get all session directories with their last modified times.
        
        Returns:
            List of (path, mtime) tuples sorted by age (oldest first)
        """
        sessions = []
        try:
            for item in self.target_dir.iterdir():
                if item.is_dir():
                    # Get the most recent modification time for the session dir
                    mtime = item.stat().st_mtime
                    sessions.append((item, mtime))
        except Exception as e:
            logger.error(f"Error scanning session directories: {e}")
        
        # Sort by modification time (oldest first)
        sessions.sort(key=lambda x: x[1])
        return sessions
    
    def delete_session_dir(self, session_path: Path) -> bool:
        """
        Safely delete a session directory.
        
        Args:
            session_path: Path to session directory
            
        Returns:
            True if deleted successfully, False otherwise
        """
        try:
            shutil.rmtree(session_path)
            logger.info(f"Deleted session directory: {session_path.name}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete {session_path}: {e}")
            return False
    
    def cleanup_old_sessions(self) -> dict:
        """
        Remove sessions older than max_age_seconds.
        
        Returns:
            Dict with cleanup statistics
        """
        current_time = time.time()
        sessions = self.get_session_dirs()
        
        deleted_count = 0
        freed_space = 0
        
        for session_path, mtime in sessions:
            age_seconds = current_time - mtime
            
            if age_seconds > self.max_age_seconds:
                # Calculate size before deletion
                try:
                    size = sum(
                        f.stat().st_size 
                        for f in session_path.rglob('*') 
                        if f.is_file()
                    )
                except:
                    size = 0
                
                if self.delete_session_dir(session_path):
                    deleted_count += 1
                    freed_space += size
        
        return {
            "deleted_count": deleted_count,
            "freed_mb": freed_space / (1024**2),
            "reason": "age-based"
        }
    
    def cleanup_by_disk_usage(self, aggressive: bool = False) -> dict:
        """
        Remove oldest sessions until disk usage is acceptable.
        
        Args:
            aggressive: If True, clean more aggressively
            
        Returns:
            Dict with cleanup statistics
        """
        used_percent, used_gb, free_gb = self.get_disk_usage()
        
        # Determine target based on mode
        if aggressive:
            target_percent = self.disk_threshold - 10  # Clean down to 10% below threshold
        else:
            target_percent = self.disk_threshold - 5   # Clean down to 5% below threshold
        
        if used_percent < target_percent and free_gb >= (self.min_free_bytes / 1024**3):
            return {
                "deleted_count": 0,
                "freed_mb": 0,
                "reason": "disk-usage-acceptable"
            }
        
        sessions = self.get_session_dirs()
        deleted_count = 0
        freed_space = 0
        
        logger.warning(
            f"Disk usage at {used_percent:.1f}%, cleaning {'aggressively' if aggressive else 'normally'}"
        )
        
        for session_path, mtime in sessions:
            # Check current disk usage
            used_percent, used_gb, free_gb = self.get_disk_usage()
            
            if used_percent < target_percent and free_gb >= (self.min_free_bytes / 1024**3):
                break
            
            # Calculate size before deletion
            try:
                size = sum(
                    f.stat().st_size 
                    for f in session_path.rglob('*') 
                    if f.is_file()
                )
            except:
                size = 0
            
            if self.delete_session_dir(session_path):
                deleted_count += 1
                freed_space += size
        
        return {
            "deleted_count": deleted_count,
            "freed_mb": freed_space / (1024**2),
            "reason": "disk-threshold" if not aggressive else "emergency-cleanup"
        }
    
    def run_cleanup(self) -> dict:
        """
        Run comprehensive cleanup with all policies.
        
        Returns:
            Dict with combined cleanup statistics
        """
        logger.info("Starting scheduled cleanup...")
        
        used_percent, used_gb, free_gb = self.get_disk_usage()
        logger.info(f"Disk usage: {used_percent:.1f}% ({used_gb:.2f}GB used, {free_gb:.2f}GB free)")
        
        results = {
            "timestamp": datetime.now().isoformat(),
            "initial_disk_usage_percent": used_percent,
            "initial_free_gb": free_gb
        }
        
        # 1. Age-based cleanup (always run)
        age_result = self.cleanup_old_sessions()
        results["age_cleanup"] = age_result
        
        # 2. Check if disk-based cleanup needed
        used_percent, _, free_gb = self.get_disk_usage()
        
        if used_percent >= self.emergency_threshold:
            # Emergency cleanup
            disk_result = self.cleanup_by_disk_usage(aggressive=True)
            results["disk_cleanup"] = disk_result
            results["cleanup_mode"] = "emergency"
        elif used_percent >= self.disk_threshold or free_gb < (self.min_free_bytes / 1024**3):
            # Normal threshold cleanup
            disk_result = self.cleanup_by_disk_usage(aggressive=False)
            results["disk_cleanup"] = disk_result
            results["cleanup_mode"] = "threshold"
        else:
            results["cleanup_mode"] = "normal"
        
        # Final disk usage
        used_percent, used_gb, free_gb = self.get_disk_usage()
        results["final_disk_usage_percent"] = used_percent
        results["final_free_gb"] = free_gb
        
        logger.info(
            f"Cleanup complete. Disk usage: {used_percent:.1f}% "
            f"({free_gb:.2f}GB free)"
        )
        
        return results
    
    async def start_background_cleanup(self):
        """Run periodic cleanup in background."""
        while True:
            try:
                self.run_cleanup()
            except Exception as e:
                logger.error(f"Cleanup error: {e}")
            
            await asyncio.sleep(self.cleanup_interval)






