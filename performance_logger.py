#!/usr/bin/env python3
"""
Performance Logger for Audio Transcription
Tracks timing metrics for transcription and post-processing steps
"""

import time
import json
import os
from datetime import datetime
from typing import Optional, Dict, Any
from pathlib import Path


class PerformanceLogger:
    """Logger for tracking performance metrics of audio transcription pipeline"""
    
    def __init__(self, log_file: Optional[str] = None, console_output: bool = True):
        """
        Initialize performance logger.
        
        Args:
            log_file: Path to log file (optional). If None, logs to performance_logs.jsonl
            console_output: Whether to print metrics to console
        """
        self.console_output = console_output
        self.log_file = log_file or "performance_logs.jsonl"
        self.current_session = {}
        self.session_start = None
        
    def start_session(self, audio_file: str) -> None:
        """
        Start a new performance tracking session.
        
        Args:
            audio_file: Path to the audio file being processed
        """
        self.session_start = time.time()
        file_size = os.path.getsize(audio_file) if os.path.exists(audio_file) else 0
        
        self.current_session = {
            "timestamp": datetime.now().isoformat(),
            "audio_file": os.path.basename(audio_file),
            "file_size_bytes": file_size,
            "file_size_mb": round(file_size / (1024 * 1024), 2),
            "steps": {},
            "total_time_ms": 0
        }
        
        if self.console_output:
            print(f"\n{'='*60}")
            print(f"🎵 Performance Tracking Started")
            print(f"   File: {os.path.basename(audio_file)}")
            print(f"   Size: {self.current_session['file_size_mb']} MB ({file_size:,} bytes)")
            print(f"{'='*60}")
    
    def log_step(self, step_name: str, duration_ms: float, **metadata) -> None:
        """
        Log a processing step with its duration.
        
        Args:
            step_name: Name of the processing step
            duration_ms: Duration in milliseconds
            **metadata: Additional metadata to log
        """
        step_data = {
            "duration_ms": round(duration_ms, 2),
            **metadata
        }
        
        self.current_session["steps"][step_name] = step_data
        
        if self.console_output:
            print(f"⏱️  {step_name}: {duration_ms:.0f}ms", end="")
            if metadata:
                meta_str = ", ".join(f"{k}={v}" for k, v in metadata.items())
                print(f" ({meta_str})", end="")
            print()
    
    def end_session(self, success: bool = True, error: Optional[str] = None) -> Dict[str, Any]:
        """
        End the current session and calculate total time.
        
        Args:
            success: Whether the processing was successful
            error: Error message if processing failed
            
        Returns:
            Dictionary containing all session metrics
        """
        if self.session_start:
            total_time = (time.time() - self.session_start) * 1000
            self.current_session["total_time_ms"] = round(total_time, 2)
        
        self.current_session["success"] = success
        if error:
            self.current_session["error"] = error
        
        # Calculate breakdown percentages
        if self.current_session["total_time_ms"] > 0:
            self.current_session["breakdown_percent"] = {}
            for step_name, step_data in self.current_session["steps"].items():
                percentage = (step_data["duration_ms"] / self.current_session["total_time_ms"]) * 100
                self.current_session["breakdown_percent"][step_name] = round(percentage, 1)
        
        # Write to log file
        self._write_to_file()
        
        # Print summary
        if self.console_output:
            self._print_summary()
        
        return self.current_session.copy()
    
    def _print_summary(self) -> None:
        """Print a formatted summary of the session"""
        print(f"\n{'='*60}")
        print(f"📊 Performance Summary")
        print(f"{'='*60}")
        
        # File info
        print(f"File: {self.current_session['audio_file']}")
        print(f"Size: {self.current_session['file_size_mb']} MB")
        print(f"Status: {'✅ Success' if self.current_session.get('success', False) else '❌ Failed'}")
        
        if self.current_session.get('error'):
            print(f"Error: {self.current_session['error']}")
        
        print(f"\n{'Step Breakdown:':<30} {'Time':<12} {'%':<8}")
        print(f"{'-'*50}")
        
        # Sort steps by duration (descending)
        sorted_steps = sorted(
            self.current_session["steps"].items(),
            key=lambda x: x[1]["duration_ms"],
            reverse=True
        )
        
        for step_name, step_data in sorted_steps:
            duration = step_data["duration_ms"]
            percentage = self.current_session["breakdown_percent"].get(step_name, 0)
            print(f"{step_name:<30} {duration:>8.0f}ms   {percentage:>5.1f}%")
        
        print(f"{'-'*50}")
        print(f"{'TOTAL':<30} {self.current_session['total_time_ms']:>8.0f}ms   100.0%")
        print(f"{'='*60}\n")
    
    def _write_to_file(self) -> None:
        """Write session data to log file in JSON Lines format"""
        try:
            # Ensure directory exists
            log_dir = os.path.dirname(self.log_file)
            if log_dir and not os.path.exists(log_dir):
                os.makedirs(log_dir, exist_ok=True)
            
            # Append to file
            with open(self.log_file, 'a', encoding='utf-8') as f:
                f.write(json.dumps(self.current_session) + '\n')
        except Exception as e:
            if self.console_output:
                print(f"⚠️  Warning: Failed to write to log file: {e}")


class StepTimer:
    """Context manager for timing individual steps"""
    
    def __init__(self, logger: PerformanceLogger, step_name: str, **metadata):
        """
        Initialize step timer.
        
        Args:
            logger: PerformanceLogger instance
            step_name: Name of the step being timed
            **metadata: Additional metadata to log
        """
        self.logger = logger
        self.step_name = step_name
        self.metadata = metadata
        self.start_time = None
    
    def __enter__(self):
        self.start_time = time.time()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        duration_ms = (time.time() - self.start_time) * 1000
        self.logger.log_step(self.step_name, duration_ms, **self.metadata)
        return False  # Don't suppress exceptions


def analyze_logs(log_file: str = "performance_logs.jsonl", 
                 last_n: Optional[int] = None) -> Dict[str, Any]:
    """
    Analyze performance logs and generate statistics.
    
    Args:
        log_file: Path to the log file
        last_n: Only analyze the last N entries (None for all)
        
    Returns:
        Dictionary containing analysis results
    """
    if not os.path.exists(log_file):
        return {"error": "Log file not found"}
    
    sessions = []
    with open(log_file, 'r', encoding='utf-8') as f:
        for line in f:
            try:
                sessions.append(json.loads(line.strip()))
            except json.JSONDecodeError:
                continue
    
    if not sessions:
        return {"error": "No valid sessions found"}
    
    # Get last N sessions if specified
    if last_n:
        sessions = sessions[-last_n:]
    
    # Calculate statistics
    total_sessions = len(sessions)
    successful_sessions = sum(1 for s in sessions if s.get("success", False))
    
    # Average times per step
    step_times = {}
    for session in sessions:
        for step_name, step_data in session.get("steps", {}).items():
            if step_name not in step_times:
                step_times[step_name] = []
            step_times[step_name].append(step_data["duration_ms"])
    
    step_averages = {
        step: {
            "avg_ms": round(sum(times) / len(times), 2),
            "min_ms": round(min(times), 2),
            "max_ms": round(max(times), 2),
            "count": len(times)
        }
        for step, times in step_times.items()
    }
    
    # Overall statistics
    total_times = [s["total_time_ms"] for s in sessions if "total_time_ms" in s]
    file_sizes = [s["file_size_mb"] for s in sessions if "file_size_mb" in s]
    
    analysis = {
        "summary": {
            "total_sessions": total_sessions,
            "successful_sessions": successful_sessions,
            "failed_sessions": total_sessions - successful_sessions,
            "success_rate": round((successful_sessions / total_sessions) * 100, 1) if total_sessions > 0 else 0
        },
        "overall_performance": {
            "avg_total_time_ms": round(sum(total_times) / len(total_times), 2) if total_times else 0,
            "min_total_time_ms": round(min(total_times), 2) if total_times else 0,
            "max_total_time_ms": round(max(total_times), 2) if total_times else 0,
            "avg_file_size_mb": round(sum(file_sizes) / len(file_sizes), 2) if file_sizes else 0
        },
        "step_performance": step_averages,
        "analyzed_sessions": total_sessions
    }
    
    return analysis


def print_analysis(analysis: Dict[str, Any]) -> None:
    """Print formatted analysis results"""
    if "error" in analysis:
        print(f"❌ Error: {analysis['error']}")
        return
    
    print(f"\n{'='*70}")
    print(f"📈 Performance Analysis Report")
    print(f"{'='*70}")
    
    # Summary
    summary = analysis["summary"]
    print(f"\n📊 Summary:")
    print(f"   Total Sessions: {summary['total_sessions']}")
    print(f"   Successful: {summary['successful_sessions']} ({summary['success_rate']}%)")
    print(f"   Failed: {summary['failed_sessions']}")
    
    # Overall performance
    overall = analysis["overall_performance"]
    print(f"\n⏱️  Overall Performance:")
    print(f"   Average Total Time: {overall['avg_total_time_ms']:.0f}ms")
    print(f"   Min Total Time: {overall['min_total_time_ms']:.0f}ms")
    print(f"   Max Total Time: {overall['max_total_time_ms']:.0f}ms")
    print(f"   Average File Size: {overall['avg_file_size_mb']:.2f} MB")
    
    # Step performance
    print(f"\n🔍 Step Performance (Average):")
    print(f"   {'Step':<30} {'Avg':<12} {'Min':<12} {'Max':<12} {'Count':<8}")
    print(f"   {'-'*74}")
    
    # Sort by average time
    sorted_steps = sorted(
        analysis["step_performance"].items(),
        key=lambda x: x[1]["avg_ms"],
        reverse=True
    )
    
    for step_name, stats in sorted_steps:
        print(f"   {step_name:<30} {stats['avg_ms']:>8.0f}ms   {stats['min_ms']:>8.0f}ms   {stats['max_ms']:>8.0f}ms   {stats['count']:>5}")
    
    print(f"{'='*70}\n")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Analyze performance logs")
    parser.add_argument("--log-file", default="performance_logs.jsonl", help="Path to log file")
    parser.add_argument("--last", type=int, help="Analyze only the last N sessions")
    
    args = parser.parse_args()
    
    analysis = analyze_logs(args.log_file, args.last)
    print_analysis(analysis)
