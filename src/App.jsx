import React, { useState, useEffect, useRef } from "react";
import "./index.css";
import { useToast } from "./components/ui/Toast";
import { useHotkey } from "./hooks/useHotkey";
import { useWindowDrag } from "./hooks/useWindowDrag";
import { useAudioLevel } from "./hooks/useAudioLevel";
import { useAudioRecording } from "./hooks/useAudioRecording";
import { useSettings } from "./hooks/useSettings";

// Sound Wave Icon Component (for idle/hover states)
const SoundWaveIcon = ({ size = 16 }) => {
  return (
    <div className="flex items-center justify-center gap-1">
      <div
        className={`rounded-full bg-white`}
        style={{ width: size * 0.25, height: size * 0.6 }}
      ></div>
      <div className={`rounded-full bg-white`} style={{ width: size * 0.25, height: size }}></div>
      <div
        className={`rounded-full bg-white`}
        style={{ width: size * 0.25, height: size * 0.6 }}
      ></div>
    </div>
  );
};

// Voice Wave Animation Component (for processing state)
const VoiceWaveIndicator = ({ isListening }) => {
  return (
    <div className="flex items-center justify-center gap-0.5">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className={`w-0.5 rounded-full bg-white transition-all duration-150 ${
            isListening ? "h-4 animate-pulse" : "h-2"
          }`}
          style={{
            animationDelay: isListening ? `${i * 0.1}s` : "0s",
            animationDuration: isListening ? `${0.6 + i * 0.1}s` : "0s",
          }}
        />
      ))}
    </div>
  );
};

// Volume Meter Component - displays audio level visually
const VolumeMeter = ({ level }) => {
  return (
    <div className="flex items-center justify-center gap-0.5">
      {[...Array(5)].map((_, i) => {
        const barThreshold = (i + 1) * 20; // 20, 40, 60, 80, 100
        const isActive = level >= barThreshold;
        const height = 4 + (i * 3); // Progressive heights: 4, 7, 10, 13, 16

        return (
          <div
            key={i}
            className={`w-1 rounded-full transition-all duration-100 ${
              isActive ? 'bg-white' : 'bg-white/30'
            }`}
            style={{ height: `${height}px` }}
          />
        );
      })}
    </div>
  );
};

// Recording Timer Component
const RecordingTimer = ({ startTime }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime) return;

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return (
    <div className="text-xs font-mono text-white/90">
      {minutes}:{seconds.toString().padStart(2, '0')}
    </div>
  );
};

// State Badge Component - shows current state with text
const StateBadge = ({ state, className = "" }) => {
  const stateConfig = {
    idle: { text: "Ready", color: "bg-neutral-600/80" },
    hover: { text: "Click to speak", color: "bg-neutral-600/90" },
    recording: { text: "Recording", color: "bg-green-600/90" },
    processing: { text: "Processing", color: "bg-orange-600/90" },
  };

  const config = stateConfig[state] || stateConfig.idle;

  return (
    <div className={`absolute -top-8 left-1/2 -translate-x-1/2 ${className}`}>
      <div className={`px-2 py-1 rounded-md ${config.color} backdrop-blur-sm text-white text-xs font-medium whitespace-nowrap`}>
        {config.text}
      </div>
    </div>
  );
};

// Ripple Effect Component for recording state
const RippleEffect = () => {
  return (
    <>
      <div className="absolute inset-0 rounded-full bg-green-400/30 animate-ping" style={{ animationDuration: '1.5s' }}></div>
      <div className="absolute inset-0 rounded-full bg-green-400/20 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }}></div>
    </>
  );
};

// Enhanced Tooltip Component
const Tooltip = ({ children, content, emoji }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-block">
      <div onMouseEnter={() => setIsVisible(true)} onMouseLeave={() => setIsVisible(false)}>
        {children}
      </div>
      {isVisible && (
        <div
          className="absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 transform rounded-md bg-gradient-to-r from-neutral-800 to-neutral-700 px-1 py-1 whitespace-nowrap text-white transition-opacity duration-150"
          style={{ fontSize: "9.7px" }}
        >
          {emoji && <span className="mr-1">{emoji}</span>}
          {content}
          <div className="absolute top-full left-1/2 h-0 w-0 -translate-x-1/2 transform border-t-2 border-r-2 border-l-2 border-transparent border-t-neutral-800"></div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [isHovered, setIsHovered] = useState(false);
  const [isCommandMenuOpen, setIsCommandMenuOpen] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState(null);
  const commandMenuRef = useRef(null);
  const buttonRef = useRef(null);
  const { toast } = useToast();
  const { hotkey } = useHotkey();
  const { isDragging, handleMouseDown, handleMouseUp } = useWindowDrag();
  const [dragStartPos, setDragStartPos] = useState(null);
  const [hasDragged, setHasDragged] = useState(false);

  // Translation settings
  const {
    enableTranslation,
    targetLanguage,
    preferredLanguage,
    reasoningModel,
    translationModel,
    openaiApiKey,
    anthropicApiKey,
    geminiApiKey,
  } = useSettings();

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

  const { isRecording, isProcessing, toggleListening, audioStream } = useAudioRecording(
    toast,
    {
      onToggle: handleDictationToggle,
      // Translation settings
      enableTranslation,
      targetLanguage,
      preferredLanguage,
      translationModel,
      openaiApiKey,
      anthropicApiKey,
      geminiApiKey,
    }
  );

  // Monitor audio level while recording
  const audioLevel = useAudioLevel(audioStream, isRecording);

  // Track recording start time
  useEffect(() => {
    if (isRecording) {
      setRecordingStartTime(Date.now());
    } else {
      setRecordingStartTime(null);
    }
  }, [isRecording]);

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
      "rounded-full w-14 h-14 flex items-center justify-center relative overflow-hidden border-2 border-white/70 cursor-pointer transition-all duration-300";

    switch (micState) {
      case "idle":
        return {
          className: `${baseClasses} bg-neutral-700/80 cursor-pointer hover:bg-neutral-600/80`,
          tooltip: `Press [${hotkey}] to speak`,
        };
      case "hover":
        return {
          className: `${baseClasses} bg-neutral-600/80 cursor-pointer scale-105`,
          tooltip: `Press [${hotkey}] to speak`,
        };
      case "recording":
        return {
          className: `${baseClasses} bg-green-600 cursor-pointer`,
          tooltip: "Recording...",
        };
      case "processing":
        return {
          className: `${baseClasses} bg-orange-600 cursor-not-allowed`,
          tooltip: "Processing...",
        };
      default:
        return {
          className: `${baseClasses} bg-neutral-700/80 cursor-pointer`,
          style: { transform: "scale(0.8)" },
          tooltip: "Click to speak",
        };
    }
  };

  const micProps = getMicButtonProps();

  return (
    <>
      {/* Fixed bottom-right voice button */}
      <div className="fixed right-6 bottom-6 z-50">
        <div className="relative">
          {/* State Badge - shows above button */}
          {(isRecording || isProcessing) && <StateBadge state={micState} />}

          {/* Recording Timer - shows above badge */}
          {isRecording && recordingStartTime && (
            <div className="absolute -top-16 left-1/2 -translate-x-1/2">
              <RecordingTimer startTime={recordingStartTime} />
            </div>
          )}

          <Tooltip content={micProps.tooltip}>
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
                  "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.3s ease-out",
              }}
            >
              {/* Ripple effect for recording */}
              {micState === "recording" && <RippleEffect />}

              {/* Background effects */}
              <div
                className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent transition-opacity duration-300"
                style={{ opacity: micState === "hover" ? 0.8 : 0 }}
              ></div>

              {/* Dynamic content based on state */}
              {micState === "idle" || micState === "hover" ? (
                <SoundWaveIcon size={micState === "idle" ? 14 : 16} />
              ) : micState === "recording" ? (
                <VolumeMeter level={audioLevel} />
              ) : micState === "processing" ? (
                <VoiceWaveIndicator isListening={true} />
              ) : null}

              {/* Volume ring indicator for recording */}
              {micState === "recording" && (
                <div
                  className="absolute inset-0 rounded-full border-2 border-green-300 transition-opacity duration-100"
                  style={{ opacity: audioLevel / 200 }}
                ></div>
              )}

              {/* Processing indicator ring */}
              {micState === "processing" && (
                <div className="absolute inset-0 rounded-full border-2 border-orange-300 opacity-50 animate-pulse"></div>
              )}
            </button>
          </Tooltip>
          {isCommandMenuOpen && (
            <div
              ref={commandMenuRef}
              className="absolute right-0 bottom-full mb-3 w-48 rounded-lg border border-white/10 bg-neutral-900/95 text-white shadow-lg backdrop-blur-sm"
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
              <div className="h-px bg-white/10" />
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-white/10 focus:bg-white/10 focus:outline-none"
                onClick={() => {
                  window.electronAPI?.openDevTools?.();
                  setIsCommandMenuOpen(false);
                }}
              >
                Open DevTools (Debug)
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
