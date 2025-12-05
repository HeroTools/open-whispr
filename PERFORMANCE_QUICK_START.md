# Performance Logging System - Quick Start Guide

## What I've Created

I've built a comprehensive performance logging system for your OpenWhispr audio transcription application. This system tracks:

✅ **File sizes** (bytes and MB)  
✅ **Processing time** for each step (transcription API, post-processing, etc.)  
✅ **Total processing time**  
✅ **Percentage breakdown** of where time is spent  
✅ **Success/failure tracking**  

## Files Created

1. **`performance_logger.py`** - Core logging utility
2. **`example_performance_logging.py`** - Demo script
3. **`analyze_model_performance.py`** - Model comparison tool
4. **`PERFORMANCE_LOGGING.md`** - Full documentation
5. **`performance_logs.jsonl`** - Log file (auto-created)

## How to Use

### Option 1: Quick Demo

```bash
python example_performance_logging.py
```

This runs a simulation and shows you the output format.

### Option 2: Integrate into Your Code

Add this to your transcription code:

```python
from performance_logger import PerformanceLogger, StepTimer

# At the start of processing
logger = PerformanceLogger(console_output=True)
logger.start_session(audio_file_path)

# Wrap each step
with StepTimer(logger, "transcription_api", model="whisper-1"):
    # Your transcription code
    result = transcribe(audio)

with StepTimer(logger, "post_processing", model="gpt-4.1-mini"):
    # Your post-processing code
    processed = process(result)

# At the end
metrics = logger.end_session(success=True)
```

### Option 3: Analyze Existing Logs

```bash
# Analyze all logs
python performance_logger.py

# Analyze last 10 sessions
python performance_logger.py --last 10

# Compare model performance
python analyze_model_performance.py
```

## What You'll See

### During Processing

```
============================================================
🎵 Performance Tracking Started
   File: audio.wav
   Size: 0.10 MB (102,400 bytes)
============================================================
⏱️  transcription_api: 717ms (model=whisper-1)
⏱️  post_processing: 1081ms (model=gpt-4.1-mini)

============================================================
📊 Performance Summary
============================================================
File: audio.wav
Size: 0.10 MB
Status: ✅ Success

Step Breakdown:                Time        %
--------------------------------------------------
post_processing                1081ms    60.1%
transcription_api               717ms    39.9%
--------------------------------------------------
TOTAL                          1798ms   100.0%
============================================================
```

### Model Comparison

```
======================================================================
📊 Model Performance Comparison
======================================================================

🤖 gpt-4.1-mini
   ────────────────────────────────────────────────────────
   Samples: 5
   Average Time: 848ms
   Min Time: 571ms
   Max Time: 1081ms

🤖 gpt-5-mini
   ────────────────────────────────────────────────────────
   Samples: 3
   Average Time: 5355ms
   Min Time: 3809ms
   Max Time: 7370ms

======================================================================
⚖️  Comparison
======================================================================

✅ gpt-4.1-mini is FASTER
   gpt-4.1-mini: 848ms average
   gpt-5-mini: 5355ms average
   Difference: 4507ms (6.3x faster)
   gpt-5-mini is 531% slower than gpt-4.1-mini
======================================================================
```

## Answering Your Question

Based on your console logs, **YES, GPT-5-mini performs much worse than GPT-4.1-mini**:

- **GPT-4.1-mini**: ~571-1081ms (average ~848ms)
- **GPT-5-mini**: ~3809-7370ms (average ~5355ms)
- **GPT-5-mini is 6.3x slower!**

For a voice dictation app where speed is critical, GPT-4.1-mini is the clear winner.

## Next Steps

1. **Test the demo**: `python example_performance_logging.py`
2. **Integrate into your code**: Use the examples above
3. **Analyze your data**: Run `python analyze_model_performance.py` after collecting real logs
4. **Read full docs**: Check `PERFORMANCE_LOGGING.md` for advanced usage

## Log File Format

Logs are stored in JSON Lines format (`performance_logs.jsonl`), one JSON object per line:

```json
{
  "timestamp": "2025-11-26T07:46:11.123456",
  "audio_file": "audio.wav",
  "file_size_bytes": 102400,
  "file_size_mb": 0.10,
  "steps": {
    "transcription_api": {
      "duration_ms": 717.0,
      "model": "whisper-1"
    },
    "post_processing": {
      "duration_ms": 1081.0,
      "model": "gpt-4.1-mini"
    }
  },
  "total_time_ms": 1798.0,
  "success": true,
  "breakdown_percent": {
    "transcription_api": 39.9,
    "post_processing": 60.1
  }
}
```

This format is:
- ✅ Easy to parse
- ✅ Append-only (no file corruption)
- ✅ Compatible with log analysis tools
- ✅ Human-readable

## Tips

- Set `console_output=False` in production to reduce noise
- Use metadata in `StepTimer` to track model names, languages, etc.
- Regularly analyze logs to find bottlenecks
- Compare different models/providers to optimize performance

---

**Questions?** Check `PERFORMANCE_LOGGING.md` for detailed documentation.
