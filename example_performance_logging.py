#!/usr/bin/env python3
"""
Example script demonstrating the Performance Logger usage
Run this to test audio transcription with performance tracking
"""

import sys
import os

# Add the current directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from performance_logger import PerformanceLogger, StepTimer, analyze_logs, print_analysis
import time


def example_transcription_with_logging(audio_file):
    """Example of how to use the performance logger in transcription"""
    
    # Initialize logger
    perf_logger = PerformanceLogger(
        log_file="performance_logs.jsonl",
        console_output=True
    )
    
    # Start tracking session
    perf_logger.start_session(audio_file)
    
    try:
        # Simulate model loading
        with StepTimer(perf_logger, "model_loading", model="base"):
            time.sleep(0.5)  # Simulating model load time
        
        # Simulate API call for transcription
        with StepTimer(perf_logger, "api_transcription", provider="OpenAI", model="whisper-1"):
            time.sleep(2.0)  # Simulating API call
        
        # Simulate post-processing with reasoning
        with StepTimer(perf_logger, "post_processing_reasoning", model="gpt-4.1-mini"):
            time.sleep(1.0)  # Simulating reasoning
        
        # Simulate text cleanup
        with StepTimer(perf_logger, "text_cleanup"):
            time.sleep(0.1)  # Simulating cleanup
        
        # End session successfully
        metrics = perf_logger.end_session(success=True)
        
        return metrics
        
    except Exception as e:
        # End session with error
        perf_logger.end_session(success=False, error=str(e))
        raise


def main():
    print("Performance Logger Demo")
    print("=" * 60)
    
    # Create a dummy audio file for testing
    test_audio = "test_audio.wav"
    if not os.path.exists(test_audio):
        # Create a small dummy file
        with open(test_audio, 'wb') as f:
            f.write(b'\x00' * (1024 * 100))  # 100KB dummy file
    
    # Run example transcription
    print("\n1. Running example transcription with logging...")
    metrics = example_transcription_with_logging(test_audio)
    
    # Run a few more times to generate data
    print("\n2. Running additional transcriptions for analysis...")
    for i in range(3):
        print(f"\n   Run {i+2}/4...")
        example_transcription_with_logging(test_audio)
        time.sleep(0.5)
    
    # Analyze the logs
    print("\n3. Analyzing performance logs...")
    analysis = analyze_logs("performance_logs.jsonl", last_n=10)
    print_analysis(analysis)
    
    # Clean up
    if os.path.exists(test_audio):
        os.remove(test_audio)
    
    print("\n✅ Demo complete! Check 'performance_logs.jsonl' for detailed logs.")


if __name__ == "__main__":
    main()
