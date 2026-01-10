#!/usr/bin/env python3
"""
Whisper Bridge Script for OpenWhispr
Handles local speech-to-text processing using OpenAI's Whisper model
"""

import sys
import json
import os
import argparse
import whisper
import threading
import time
import requests
import gc


def get_whisper_cache_dir():
    """Get platform-appropriate cache directory for Whisper models"""
    if sys.platform == "win32":
        # Windows: use %LOCALAPPDATA%\whisper or fallback to %USERPROFILE%\.cache\whisper
        local_app_data = os.environ.get("LOCALAPPDATA")
        if local_app_data:
            return os.path.join(local_app_data, "whisper")
        # Fallback to user profile
        user_profile = os.environ.get("USERPROFILE", os.path.expanduser("~"))
        return os.path.join(user_profile, ".cache", "whisper")
    else:
        # macOS/Linux: use ~/.cache/whisper
        return os.path.expanduser("~/.cache/whisper")


def get_ffmpeg_path():
    """Get path to bundled FFmpeg executable with proper production support"""
    # Check environment variables first
    env_paths = [
        ("FFMPEG_PATH", os.environ.get("FFMPEG_PATH")),
        ("FFMPEG_EXECUTABLE", os.environ.get("FFMPEG_EXECUTABLE")),
        ("FFMPEG_BINARY", os.environ.get("FFMPEG_BINARY")),
    ]

    for env_name, env_path in env_paths:
        # On Windows, skip X_OK check since it doesn't use Unix-style execute permissions
        if env_path and os.path.exists(env_path):
            if sys.platform == "win32" or os.access(env_path, os.X_OK):
                return env_path

    # Determine base path
    if getattr(sys, "frozen", False):
        base_path = sys._MEIPASS
    else:
        base_path = os.path.dirname(os.path.abspath(__file__))

    # Try multiple possible paths for production Electron app
    possible_paths = []

    if sys.platform == "darwin":  # macOS
        possible_paths = [
            # Unpacked ASAR locations
            os.path.join(base_path, "..", "..", "..", "app.asar.unpacked", "node_modules", "ffmpeg-static", "ffmpeg"),
            os.path.join(base_path, "..", "app.asar.unpacked", "node_modules", "ffmpeg-static", "ffmpeg"),
            # Development path
            os.path.join(base_path, "node_modules", "ffmpeg-static", "ffmpeg"),
            # Alternative development path
            os.path.join(base_path, "..", "node_modules", "ffmpeg-static", "ffmpeg"),
        ]
    elif sys.platform == "win32":  # Windows
        possible_paths = [
            os.path.join(
                base_path, "..", "..", "..", "app.asar.unpacked", "node_modules", "ffmpeg-static", "ffmpeg.exe"
            ),
            os.path.join(base_path, "..", "app.asar.unpacked", "node_modules", "ffmpeg-static", "ffmpeg.exe"),
            os.path.join(base_path, "node_modules", "ffmpeg-static", "ffmpeg.exe"),
            os.path.join(base_path, "..", "node_modules", "ffmpeg-static", "ffmpeg.exe"),
        ]
    else:  # Linux
        possible_paths = [
            os.path.join(base_path, "..", "..", "..", "app.asar.unpacked", "node_modules", "ffmpeg-static", "ffmpeg"),
            os.path.join(base_path, "..", "app.asar.unpacked", "node_modules", "ffmpeg-static", "ffmpeg"),
            os.path.join(base_path, "node_modules", "ffmpeg-static", "ffmpeg"),
            os.path.join(base_path, "..", "node_modules", "ffmpeg-static", "ffmpeg"),
        ]

    # Try each possible path
    for ffmpeg_path in possible_paths:
        abs_path = os.path.abspath(ffmpeg_path)
        # On Windows, skip X_OK check since it doesn't use Unix-style execute permissions
        if os.path.exists(abs_path):
            if sys.platform == "win32" or os.access(abs_path, os.X_OK):
                return abs_path

    # Try system FFmpeg as last resort
    if sys.platform == "darwin":
        common_ffmpeg_paths = [
            "/opt/homebrew/bin/ffmpeg",  # Homebrew on Apple Silicon
            "/usr/local/bin/ffmpeg",  # Homebrew on Intel or manual installs
            "/usr/bin/ffmpeg",  # System location
            "ffmpeg",  # In PATH
        ]
    else:
        common_ffmpeg_paths = ["ffmpeg"]

    for ffmpeg_cmd in common_ffmpeg_paths:
        try:
            import subprocess

            result = subprocess.run([ffmpeg_cmd, "-version"], capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                return ffmpeg_cmd
        except Exception:
            continue

    return None


# Set FFmpeg path for Whisper
ffmpeg_path = get_ffmpeg_path()
if ffmpeg_path:
    os.environ["FFMPEG_BINARY"] = ffmpeg_path

    # CRITICAL: Add ffmpeg directory to PATH so Whisper can find it
    ffmpeg_dir = os.path.dirname(os.path.abspath(ffmpeg_path))
    current_path = os.environ.get("PATH", "")
    if ffmpeg_dir not in current_path:
        os.environ["PATH"] = f"{ffmpeg_dir}{os.pathsep}{current_path}"

    # For Whisper library, we need to ensure 'ffmpeg' command works
    # Create a symlink if needed (for macOS/Linux)
    if sys.platform != "win32" and os.path.isfile(ffmpeg_path) and os.path.basename(ffmpeg_path) != "ffmpeg":
        symlink_path = os.path.join(ffmpeg_dir, "ffmpeg")
        if not os.path.exists(symlink_path):
            try:
                os.symlink(ffmpeg_path, symlink_path)
            except Exception:
                pass

# Global model cache to avoid reloading
_model_cache = {}


def load_model(model_name="base"):
    """Load Whisper model with caching for performance"""
    global _model_cache

    # Return cached model if available
    if model_name in _model_cache:
        return _model_cache[model_name]

    try:
        model = whisper.load_model(model_name)

        if len(_model_cache) >= 2:
            oldest_key = next(iter(_model_cache))
            del _model_cache[oldest_key]
            gc.collect()

        _model_cache[model_name] = model
        return model
    except Exception:
        return None


def get_expected_model_size(model_name):
    """Get expected file size for a model by checking the remote URL"""
    try:
        model_url = whisper._MODELS[model_name]
        response = requests.head(model_url, timeout=10)
        if response.status_code == 200:
            content_length = response.headers.get("content-length")
            if content_length:
                return int(content_length)
    except Exception:
        pass

    approximate_sizes = {
        "tiny": 39 * 1024 * 1024,
        "base": 74 * 1024 * 1024,
        "small": 244 * 1024 * 1024,
        "medium": 769 * 1024 * 1024,
        "large": 1550 * 1024 * 1024,
        "turbo": 809 * 1024 * 1024,
    }
    return approximate_sizes.get(model_name, 100 * 1024 * 1024)


def monitor_download_progress(model_name, expected_size, stop_event):
    """Monitor download progress by watching file size growth"""
    cache_dir = get_whisper_cache_dir()
    model_url = whisper._MODELS[model_name]
    model_file = os.path.join(cache_dir, os.path.basename(model_url))

    os.makedirs(cache_dir, exist_ok=True)

    last_size = 0
    last_update_time = time.time()
    speed_samples = []
    last_progress_update = 0

    while not stop_event.is_set():
        try:
            current_size = 0
            if os.path.exists(model_file):
                current_size = os.path.getsize(model_file)

            current_time = time.time()
            time_diff = current_time - last_update_time

            speed_mbps = 0
            if last_size > 0 and time_diff > 0 and current_size > last_size:
                bytes_per_second = (current_size - last_size) / time_diff
                speed_mbps = (bytes_per_second * 8) / (1024 * 1024)

                speed_samples.append(speed_mbps)
                if len(speed_samples) > 10:
                    speed_samples.pop(0)
                speed_mbps = sum(speed_samples) / len(speed_samples)

            percentage = min((current_size / expected_size * 100) if expected_size > 0 else 0, 100)

            if current_time - last_progress_update > 0.5 or abs(percentage - last_progress_update) > 1.0:
                progress_data = {
                    "type": "progress",
                    "model": model_name,
                    "downloaded_bytes": current_size,
                    "total_bytes": expected_size,
                    "percentage": round(percentage, 1),
                    "speed_mbps": round(speed_mbps, 2) if speed_mbps > 0 else 0,
                }

                print(f"PROGRESS:{json.dumps(progress_data)}", file=sys.stderr)
                last_progress_update = percentage

            if current_size >= expected_size * 0.95:
                break

            if current_size == last_size and current_time - last_update_time > 10:
                if current_size > expected_size * 0.9:
                    break

            last_size = current_size
            last_update_time = current_time

        except Exception:
            pass

        time.sleep(0.5)


def download_model(model_name="base"):
    """Download Whisper model with real-time progress monitoring"""
    stop_event = threading.Event()
    progress_thread = None

    try:
        # Check if model is already downloaded
        cache_dir = get_whisper_cache_dir()
        model_url = whisper._MODELS[model_name]
        model_file = os.path.join(cache_dir, os.path.basename(model_url))

        if os.path.exists(model_file):
            file_size = os.path.getsize(model_file)
            return {
                "model": model_name,
                "downloaded": True,
                "path": model_file,
                "size_bytes": file_size,
                "size_mb": round(file_size / (1024 * 1024), 1),
                "success": True,
            }

        # Get expected file size
        expected_size = get_expected_model_size(model_name)

        # Start progress monitoring in background thread
        progress_thread = threading.Thread(
            target=monitor_download_progress, args=(model_name, expected_size, stop_event), daemon=True
        )
        progress_thread.start()

        # Start the actual download (this will block until complete)
        whisper.load_model(model_name)

        # Stop progress monitoring
        stop_event.set()

        # Wait for progress thread to finish
        if progress_thread and progress_thread.is_alive():
            progress_thread.join(timeout=1)

        # Get final file info
        final_size = 0
        if os.path.exists(model_file):
            final_size = os.path.getsize(model_file)

        # Send completion signal
        completion_data = {
            "type": "complete",
            "model": model_name,
            "downloaded_bytes": final_size,
            "total_bytes": expected_size,
            "percentage": 100,
        }
        print(f"PROGRESS:{json.dumps(completion_data)}", file=sys.stderr)

        return {
            "model": model_name,
            "downloaded": True,
            "path": model_file,
            "size_bytes": final_size,
            "size_mb": round(final_size / (1024 * 1024), 1),
            "success": True,
        }

    except KeyboardInterrupt:
        stop_event.set()
        return {"model": model_name, "downloaded": False, "error": "Download interrupted by user", "success": False}
    except Exception as e:
        stop_event.set()
        return {"model": model_name, "downloaded": False, "error": str(e), "success": False}


def check_model_status(model_name="base"):
    """Check if a model is already downloaded"""
    try:
        cache_dir = get_whisper_cache_dir()
        model_url = whisper._MODELS[model_name]
        model_file = os.path.join(cache_dir, os.path.basename(model_url))

        if os.path.exists(model_file):
            file_size = os.path.getsize(model_file)
            return {
                "model": model_name,
                "downloaded": True,
                "path": model_file,
                "size_bytes": file_size,
                "size_mb": round(file_size / (1024 * 1024), 1),
                "success": True,
            }
        else:
            return {"model": model_name, "downloaded": False, "success": True}
    except Exception as e:
        return {"model": model_name, "error": str(e), "success": False}


def list_models():
    """List all available models and their download status"""
    models = ["tiny", "base", "small", "medium", "large", "turbo"]
    model_info = []

    for model in models:
        status = check_model_status(model)
        model_info.append(status)

    return {"models": model_info, "cache_dir": get_whisper_cache_dir(), "success": True}


def delete_model(model_name="base"):
    """Delete a downloaded Whisper model"""
    try:
        cache_dir = get_whisper_cache_dir()
        model_url = whisper._MODELS[model_name]
        model_file = os.path.join(cache_dir, os.path.basename(model_url))

        if os.path.exists(model_file):
            file_size = os.path.getsize(model_file)
            os.remove(model_file)
            return {
                "model": model_name,
                "deleted": True,
                "freed_bytes": file_size,
                "freed_mb": round(file_size / (1024 * 1024), 1),
                "success": True,
            }
        else:
            return {"model": model_name, "deleted": False, "error": "Model not found", "success": False}
    except Exception as e:
        return {"model": model_name, "deleted": False, "error": str(e), "success": False}


def transcribe_audio(audio_path, model_name="base", language=None):
    """Transcribe audio file using Whisper with optimizations"""

    if not os.path.exists(audio_path):
        return {"error": f"Audio file not found: {audio_path}", "success": False}

    try:
        # Load model (uses cache for performance)
        model = load_model(model_name)
        if model is None:
            return {"error": "Failed to load Whisper model", "success": False}

        options = {
            "fp16": False,
            "verbose": False,
        }
        if language:
            options["language"] = language

        result = model.transcribe(audio_path, **options)

        text = result.get("text", "").strip()
        language = result.get("language", "unknown")

        return {"text": text, "language": language, "success": True}

    except Exception as e:
        return {"error": str(e), "success": False}


def check_ffmpeg():
    """Check if FFmpeg is available and working"""
    try:
        import subprocess

        test_path = ffmpeg_path or "ffmpeg"

        result = subprocess.run([test_path, "-version"], capture_output=True, text=True, timeout=10)

        if result.returncode == 0:
            version_line = result.stdout.split("\n")[0] if result.stdout else "Unknown"
            return {"available": True, "path": test_path, "version": version_line, "success": True}
        else:
            return {
                "available": False,
                "error": f"FFmpeg returned code {result.returncode}: {result.stderr}",
                "success": False,
            }
    except subprocess.TimeoutExpired:
        return {"available": False, "error": "FFmpeg check timed out", "success": False}
    except FileNotFoundError:
        return {"available": False, "error": "FFmpeg not found in PATH", "success": False}
    except Exception as e:
        return {"available": False, "error": str(e), "success": False}


def main():
    parser = argparse.ArgumentParser(description="Whisper Bridge for OpenWhispr")
    parser.add_argument(
        "--mode",
        default="transcribe",
        choices=["transcribe", "download", "check", "list", "delete", "check-ffmpeg"],
        help="Operation mode (default: transcribe)",
    )
    parser.add_argument("audio_file", nargs="?", help="Path to audio file to transcribe")
    parser.add_argument(
        "--model",
        default="base",
        choices=["tiny", "base", "small", "medium", "large", "turbo"],
        help="Whisper model to use (default: base)",
    )
    parser.add_argument("--language", help="Language code (optional)")
    parser.add_argument(
        "--output-format", default="json", choices=["json", "text"], help="Output format (default: json)"
    )

    args = parser.parse_args()

    # Handle different modes
    if args.mode == "download":
        result = download_model(args.model)
        print(json.dumps(result))
        return
    elif args.mode == "check":
        result = check_model_status(args.model)
        print(json.dumps(result))
        return
    elif args.mode == "list":
        result = list_models()
        print(json.dumps(result))
        return
    elif args.mode == "delete":
        result = delete_model(args.model)
        print(json.dumps(result))
        return
    elif args.mode == "check-ffmpeg":
        result = check_ffmpeg()
        print(json.dumps(result))
        return
    elif args.mode == "transcribe":
        # Check if audio file exists
        if not args.audio_file:
            error_result = {"error": "Audio file required for transcription mode", "success": False}
            print(json.dumps(error_result))
            sys.exit(1)

        if not os.path.exists(args.audio_file):
            error_result = {"error": f"Audio file not found: {args.audio_file}", "success": False}
            print(json.dumps(error_result))
            sys.exit(1)

        # Transcribe
        result = transcribe_audio(args.audio_file, args.model, args.language)

        # Output results
        if args.output_format == "json":
            print(json.dumps(result))
        else:
            if result.get("success"):
                print(result.get("text", ""))
            else:
                print(f"Error: {result.get('error', 'Unknown error')}", file=sys.stderr)
                sys.exit(1)


if __name__ == "__main__":
    main()
