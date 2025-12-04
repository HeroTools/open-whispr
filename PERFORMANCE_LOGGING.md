# Performance Logging System

This directory contains a comprehensive performance logging system for tracking audio transcription metrics.

## Files

- **`performance_logger.py`** - Main logging utility with classes and analysis functions
- **`example_performance_logging.py`** - Demonstration script showing usage
- **`performance_logs.jsonl`** - Log file (JSON Lines format, created automatically)

## Features

### 1. Performance Logger (`PerformanceLogger`)

Tracks timing metrics for audio processing pipeline:
- File size tracking (bytes and MB)
- Individual step timing
- Total processing time
- Success/failure status
- Percentage breakdown of time spent per step

### 2. Step Timer (`StepTimer`)

Context manager for timing individual processing steps:
```python
with StepTimer(logger, "step_name", **metadata):
    # Your code here
    pass
```

### 3. Log Analysis (`analyze_logs`)

Analyzes performance logs to generate statistics:
- Average, min, max times per step
- Success rate
- Overall performance metrics

## Usage

### Basic Example

```python
from performance_logger import PerformanceLogger, StepTimer

# Initialize logger
logger = PerformanceLogger(log_file="performance_logs.jsonl", console_output=True)

# Start session
logger.start_session("audio_file.wav")

# Time individual steps
with StepTimer(logger, "transcription", model="whisper-1"):
    # Transcription code here
    result = transcribe(audio_file)

with StepTimer(logger, "post_processing", model="gpt-4.1-mini"):
    # Post-processing code here
    processed_text = process(result)

# End session
metrics = logger.end_session(success=True)
```

### Integration with Whisper Bridge

To integrate with `whisper_bridge.py`:

```python
def transcribe_audio(audio_path, model_name="base", language=None):
    from performance_logger import PerformanceLogger, StepTimer
    
    perf_logger = PerformanceLogger(console_output=True)
    perf_logger.start_session(audio_path)
    
    try:
        # Load model
        with StepTimer(perf_logger, "model_loading", model=model_name):
            model = load_model(model_name)
        
        # Transcribe
        with StepTimer(perf_logger, "transcription", model=model_name):
            result = model.transcribe(audio_path)
        
        metrics = perf_logger.end_session(success=True)
        
        return {
            "text": result["text"],
            "performance_metrics": metrics
        }
    except Exception as e:
        perf_logger.end_session(success=False, error=str(e))
        raise
```

### Analyzing Logs

```python
from performance_logger import analyze_logs, print_analysis

# Analyze all logs
analysis = analyze_logs("performance_logs.jsonl")
print_analysis(analysis)

# Analyze last 10 sessions only
analysis = analyze_logs("performance_logs.jsonl", last_n=10)
print_analysis(analysis)
```

Or from command line:
```bash
python performance_logger.py --log-file performance_logs.jsonl --last 10
```

## Output Format

### Console Output (During Processing)

```
============================================================
🎵 Performance Tracking Started
   File: audio.wav
   Size: 0.10 MB (102,400 bytes)
============================================================
⏱️  model_loading: 523ms (model=base)
⏱️  transcription: 2145ms (model=base, language=auto)
⏱️  post_processing: 1087ms (model=gpt-4.1-mini)

============================================================
📊 Performance Summary
============================================================
File: audio.wav
Size: 0.10 MB
Status: ✅ Success

Step Breakdown:                Time        %
--------------------------------------------------
transcription                  2145ms    57.1%
post_processing                1087ms    28.9%
model_loading                   523ms    13.9%
--------------------------------------------------
TOTAL                          3755ms   100.0%
============================================================
```

### Log File Format (JSON Lines)

Each line in `performance_logs.jsonl` is a JSON object:

```json
{
  "timestamp": "2025-11-26T07:46:11.123456",
  "audio_file": "audio.wav",
  "file_size_bytes": 102400,
  "file_size_mb": 0.10,
  "steps": {
    "model_loading": {
      "duration_ms": 523.45,
      "model": "base"
    },
    "transcription": {
      "duration_ms": 2145.67,
      "model": "base",
      "language": "auto"
    },
    "post_processing": {
      "duration_ms": 1087.23,
      "model": "gpt-4.1-mini"
    }
  },
  "total_time_ms": 3756.35,
  "success": true,
  "breakdown_percent": {
    "model_loading": 13.9,
    "transcription": 57.1,
    "post_processing": 28.9
  }
}
```

### Analysis Output

```
======================================================================
📈 Performance Analysis Report
======================================================================

📊 Summary:
   Total Sessions: 10
   Successful: 9 (90.0%)
   Failed: 1

⏱️  Overall Performance:
   Average Total Time: 3756ms
   Min Total Time: 3245ms
   Max Total Time: 4123ms
   Average File Size: 0.10 MB

🔍 Step Performance (Average):
   Step                           Avg         Min         Max         Count
   --------------------------------------------------------------------------
   transcription                  2145ms      1987ms      2345ms         10
   post_processing                1087ms       945ms      1234ms         10
   model_loading                   523ms       456ms       678ms         10
======================================================================
```

## Running the Demo

```bash
python example_performance_logging.py
```

This will:
1. Create a dummy audio file
2. Run 4 simulated transcriptions with logging
3. Analyze the performance logs
4. Display formatted results

## Tips

1. **Console Output**: Set `console_output=False` in production to reduce noise
2. **Log Rotation**: Implement log rotation for long-running applications
3. **Custom Metadata**: Add any metadata to `StepTimer` for detailed tracking
4. **Analysis**: Regularly analyze logs to identify performance bottlenecks

## Comparing Models

Use the logs to compare performance between different models:

```python
# Filter logs by model
import json

with open('performance_logs.jsonl', 'r') as f:
    gpt4_sessions = []
    gpt5_sessions = []
    
    for line in f:
        session = json.loads(line)
        for step_name, step_data in session.get('steps', {}).items():
            if step_data.get('model') == 'gpt-4.1-mini':
                gpt4_sessions.append(step_data['duration_ms'])
            elif step_data.get('model') == 'gpt-5-mini':
                gpt5_sessions.append(step_data['duration_ms'])

print(f"GPT-4.1-mini avg: {sum(gpt4_sessions)/len(gpt4_sessions):.0f}ms")
print(f"GPT-5-mini avg: {sum(gpt5_sessions)/len(gpt5_sessions):.0f}ms")
```
