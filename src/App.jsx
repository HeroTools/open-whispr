import React, { useState, useEffect, useRef } from "react";
import "./index.css";
import { useToast } from "./components/ui/Toast";
import { LoadingDots } from "./components/ui/LoadingDots";
import { ProcessingSpinner, VoiceProcessingIndicator } from "./components/ui/ProcessingSpinner";
import { useHotkey } from "./hooks/useHotkey";
import { useWindowDrag } from "./hooks/useWindowDrag";
import { useAudioRecording } from "./hooks/useAudioRecording";

// Sound Wave Icon Component (for idle/hover states)
const SoundWaveIcon = ({ size = 16 }) => {
  return (
    <div className="flex items-center justify-center gap-1">
      <div
        className={`bg-white rounded-full`}
        style={{ width: size * 0.25, height: size * 0.6 }}
      ></div>
      <div
        className={`bg-white rounded-full`}
        style={{ width: size * 0.25, height: size }}
      ></div>
      <div
        className={`bg-white rounded-full`}
        style={{ width: size * 0.25, height: size * 0.6 }}
      ></div>
    </div>
  );
};

// Recording Wave Animation Component (animated sound bars for recording)
const RecordingWaveIndicator = () => {
  const bars = [0, 0.1, 0.2, 0.1, 0];
  return (
    <div className="flex items-center justify-center gap-0.5 h-5">
      {bars.map((delay, i) => (
        <div
          key={i}
          className="w-1 bg-white rounded-full animate-voice-bar"
          style={{
            animationDelay: `${delay}s`,
          }}
        />
      ))}
    </div>
  );
};

// Enhanced Tooltip Component
const Tooltip = ({ children, content, emoji }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        {children}
      </div>
      {isVisible && (
        <div
          className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-1 py-1 text-white bg-gradient-to-r from-neutral-800 to-neutral-700 rounded-md whitespace-nowrap z-10 transition-opacity duration-150"
          style={{ fontSize: "9.7px" }}
        >
          {emoji && <span className="mr-1">{emoji}</span>}
          {content}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-neutral-800"></div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [isHovered, setIsHovered] = useState(false);
  const [isCommandMenuOpen, setIsCommandMenuOpen] = useState(false);
  const commandMenuRef = useRef(null);
  const buttonRef = useRef(null);
  const { toast } = useToast();
  const { hotkey } = useHotkey();
  const { isDragging, handleMouseDown, handleMouseUp } =
    useWindowDrag();
  const [dragStartPos, setDragStartPos] = useState(null);
  const [hasDragged, setHasDragged] = useState(false);

  const setWindowInteractivity = React.useCallback((shouldCapture) => {
    window.electronAPI?.setMainWindowInteractivity?.(shouldCapture);
  }, []);

  useEffect(() => {
    setWindowInteractivity(false);
    return () => setWindowInteractivity(false);
  }, [setWindowInteractivity]);

  useEffect(() => {
    if (isCommandMenuOpen) {
      setWindowInteractivity(true);
    } else if (!isHovered) {
      setWindowInteractivity(false);
    }
  }, [isCommandMenuOpen, isHovered, setWindowInteractivity]);

  const handleDictationToggle = React.useCallback(() => {
    setIsCommandMenuOpen(false);
    setWindowInteractivity(false);
  }, [setWindowInteractivity]);

  const { isRecording, isProcessing, toggleListening } = useAudioRecording(
    toast,
    {
      onToggle: handleDictationToggle,
    }
  );


  const handleClose = () => {
    window.electronAPI.hideWindow();
  };

  useEffect(() => {
    if (!isCommandMenuOpen) {
      return;
    }

    const handleClickOutside = (event) => {
      if (
        commandMenuRef.current &&
        !commandMenuRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setIsCommandMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isCommandMenuOpen]);
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === "Escape") {
        if (isCommandMenuOpen) {
          setIsCommandMenuOpen(false);
        } else {
          handleClose();
        }
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, [isCommandMenuOpen]);

  // Determine current mic state
  const getMicState = () => {
    if (isRecording) return "recording";
    if (isProcessing) return "processing";
    if (isHovered && !isRecording && !isProcessing) return "hover";
    return "idle";
  };

  const micState = getMicState();
  const isListening = isRecording || isProcessing;

  // Get microphone button properties based on state
  const getMicButtonProps = () => {
    const baseClasses =
      "rounded-full w-10 h-10 flex items-center justify-center relative border-2 cursor-pointer";

    switch (micState) {
      case "idle":
        return {
          className: `${baseClasses} bg-black/50 border-white/70`,
          tooltip: `Press [${hotkey}] to speak`,
          statusText: null,
        };
      case "hover":
        return {
          className: `${baseClasses} bg-black/50 border-white/70`,
          tooltip: `Press [${hotkey}] to speak`,
          statusText: null,
        };
      case "recording":
        return {
          className: `${baseClasses} bg-blue-500 border-blue-300 animate-recording-pulse`,
          style: {
            boxShadow: '0 0 20px rgba(59, 130, 246, 0.7), 0 0 40px rgba(59, 130, 246, 0.4)',
          },
          tooltip: `Recording... Press [${hotkey}] to stop`,
          statusText: "Recording",
        };
      case "processing":
        return {
          className: `${baseClasses} bg-purple-500 border-purple-300 cursor-not-allowed`,
          style: {
            boxShadow: '0 0 20px rgba(147, 51, 234, 0.7), 0 0 40px rgba(147, 51, 234, 0.4)',
          },
          tooltip: "Transcribing your speech...",
          statusText: "Processing",
        };
      default:
        return {
          className: `${baseClasses} bg-black/50 border-white/70`,
          style: { transform: "scale(0.8)" },
          tooltip: "Click to speak",
          statusText: null,
        };
    }
  };

  const micProps = getMicButtonProps();

  return (
    <>
      {/* Fixed bottom-right voice button */}
      <div className="fixed bottom-6 right-6 z-50">
        <div className="relative">
          <Tooltip content={micProps.tooltip}>
            <div className="flex flex-col items-center relative">
            {/* Pulsing rings for recording - outside button for visibility */}
            {micState === "recording" && (
              <>
                <div className="absolute inset-0 -m-2 rounded-full border-2 border-blue-400 animate-recording-ring pointer-events-none"></div>
                <div
                  className="absolute inset-0 -m-2 rounded-full border-2 border-blue-400 animate-recording-ring pointer-events-none"
                  style={{ animationDelay: '0.75s' }}
                ></div>
              </>
            )}
            {/* Pulsing ring for processing */}
            {micState === "processing" && (
              <div className="absolute inset-0 -m-1 rounded-full border-2 border-purple-400 opacity-70 animate-pulse pointer-events-none"></div>
            )}
            <button
              ref={buttonRef}
              onMouseDown={(e) => {
                setIsCommandMenuOpen(false);
                setDragStartPos({ x: e.clientX, y: e.clientY });
                setHasDragged(false);
                handleMouseDown(e);
              }}
              onMouseMove={(e) => {
                if (dragStartPos && !hasDragged) {
                  const distance = Math.sqrt(
                    Math.pow(e.clientX - dragStartPos.x, 2) +
                      Math.pow(e.clientY - dragStartPos.y, 2)
                  );
                  if (distance > 5) {
                    // 5px threshold for drag
                    setHasDragged(true);
                  }
                }
              }}
              onMouseUp={(e) => {
                handleMouseUp(e);
                setDragStartPos(null);
              }}
              onClick={(e) => {
                if (!hasDragged) {
                  setIsCommandMenuOpen(false);
                  toggleListening();
                }
                e.preventDefault();
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                if (!hasDragged) {
                  setWindowInteractivity(true);
                  setIsCommandMenuOpen((prev) => !prev);
                }
              }}
              onMouseEnter={() => {
                setIsHovered(true);
                setWindowInteractivity(true);
              }}
              onMouseLeave={() => {
                setIsHovered(false);
                if (!isCommandMenuOpen) {
                  setWindowInteractivity(false);
                }
              }}
              onFocus={() => setIsHovered(true)}
              onBlur={() => setIsHovered(false)}
              className={micProps.className}
              style={{
                ...micProps.style,
                cursor:
                  micState === "processing"
                    ? "not-allowed !important"
                    : isDragging
                    ? "grabbing !important"
                    : "pointer !important",
                transition:
                  "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.25s ease-out",
              }}
            >
              {/* Background effects */}
              <div
                className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent transition-opacity duration-150"
                style={{ opacity: micState === "hover" ? 0.8 : 0 }}
              ></div>
              <div
                className="absolute inset-0 transition-colors duration-150"
                style={{
                  backgroundColor:
                    micState === "hover" ? "rgba(0,0,0,0.1)" : "transparent",
                }}
              ></div>

              {/* Dynamic content based on state */}
              {micState === "idle" || micState === "hover" ? (
                <SoundWaveIcon size={micState === "idle" ? 12 : 14} />
              ) : micState === "recording" ? (
                <RecordingWaveIndicator />
              ) : micState === "processing" ? (
                <ProcessingSpinner size={18} color="white" />
              ) : null}

            </button>

            {/* Status text label */}
            {micProps.statusText && (
              <div className="animate-fade-in-up mt-2">
                <span
                  className={`text-xs font-semibold px-3 py-1 rounded-full shadow-lg ${
                    micState === "recording"
                      ? "bg-blue-500 text-white"
                      : "bg-purple-500 text-white"
                  }`}
                  style={{
                    fontSize: '11px',
                    boxShadow: micState === "recording"
                      ? '0 0 12px rgba(59, 130, 246, 0.6)'
                      : '0 0 12px rgba(147, 51, 234, 0.6)'
                  }}
                >
                  {micState === "recording" && (
                    <span className="inline-block w-2 h-2 rounded-full bg-white mr-1.5 animate-pulse"></span>
                  )}
                  {micState === "processing" && (
                    <span className="inline-block w-2 h-2 rounded-full border border-white border-t-transparent mr-1.5 animate-spin"></span>
                  )}
                  {micProps.statusText}
                </span>
              </div>
            )}
            </div>
          </Tooltip>
          {isCommandMenuOpen && (
            <div
              ref={commandMenuRef}
              className="absolute bottom-full right-0 mb-3 w-48 rounded-lg border border-white/10 bg-neutral-900/95 text-white shadow-lg backdrop-blur-sm"
              onMouseEnter={() => {
                setWindowInteractivity(true);
              }}
              onMouseLeave={() => {
                if (!isHovered) {
                  setWindowInteractivity(false);
                }
              }}
            >
              <button
                className="w-full px-3 py-2 text-left text-sm font-medium hover:bg-white/10 focus:bg-white/10 focus:outline-none"
                onClick={() => {
                  toggleListening();
                }}
              >
                {isRecording ? "Stop listening" : "Start listening"}
              </button>
              <div className="h-px bg-white/10" />
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-white/10 focus:bg-white/10 focus:outline-none"
                onClick={() => {
                setIsCommandMenuOpen(false);
                setWindowInteractivity(false);
                handleClose();
              }}
              >
                Hide this for now
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
