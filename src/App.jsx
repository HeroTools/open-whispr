import React, { useState, useEffect, useRef } from "react";
import "./index.css";
import { X } from "lucide-react";
import { useToast } from "./components/ui/Toast";
import { LoadingDots } from "./components/ui/LoadingDots";
import { useHotkey } from "./hooks/useHotkey";
import { useWindowDrag } from "./hooks/useWindowDrag";
import { useAudioRecording } from "./hooks/useAudioRecording";

// Sound Wave Icon — mint bars for idle/hover
const SoundWaveIcon = ({ size = 16, color = "#70FFBA" }) => {
  return (
    <div className="flex items-center justify-center gap-[3px]">
      <div
        className="rounded-full"
        style={{ width: size * 0.22, height: size * 0.55, backgroundColor: color }}
      />
      <div
        className="rounded-full"
        style={{ width: size * 0.22, height: size, backgroundColor: color }}
      />
      <div
        className="rounded-full"
        style={{ width: size * 0.22, height: size * 0.55, backgroundColor: color }}
      />
    </div>
  );
};

// Voice Wave Animation — staggered bars for processing state
const VoiceWaveIndicator = ({ isListening }) => {
  return (
    <div className="flex items-center justify-center gap-[2px]">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className={`w-[2px] bg-white rounded-full transition-all duration-150 ${
            isListening ? "h-4" : "h-2"
          }`}
          style={{
            animation: isListening
              ? `wave-bar 0.6s ease-in-out ${i * 0.1}s infinite alternate`
              : "none",
          }}
        />
      ))}
      <style>{`
        @keyframes wave-bar {
          0% { height: 4px; }
          100% { height: 16px; }
        }
      `}</style>
    </div>
  );
};

export default function App() {
  const [isHovered, setIsHovered] = useState(false);
  const [isCommandMenuOpen, setIsCommandMenuOpen] = useState(false);
  const commandMenuRef = useRef(null);
  const buttonRef = useRef(null);
  const { toast, toastCount } = useToast();
  const { hotkey } = useHotkey();
  const { isDragging, handleMouseDown, handleMouseUp } = useWindowDrag();
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
    const unsubscribeFallback = window.electronAPI?.onHotkeyFallbackUsed?.((data) => {
      toast({
        title: "Hotkey Changed",
        description: data.message,
        duration: 8000,
      });
    });

    const unsubscribeFailed = window.electronAPI?.onHotkeyRegistrationFailed?.((data) => {
      toast({
        title: "Hotkey Unavailable",
        description: `Could not register hotkey. Please set a different hotkey in Settings.`,
        duration: 10000,
      });
    });

    return () => {
      unsubscribeFallback?.();
      unsubscribeFailed?.();
    };
  }, [toast]);

  useEffect(() => {
    if (isCommandMenuOpen || toastCount > 0) {
      setWindowInteractivity(true);
    } else if (!isHovered) {
      setWindowInteractivity(false);
    }
  }, [isCommandMenuOpen, isHovered, toastCount, setWindowInteractivity]);

  useEffect(() => {
    const resizeWindow = () => {
      if (isCommandMenuOpen && toastCount > 0) {
        window.electronAPI?.resizeMainWindow?.("EXPANDED");
      } else if (isCommandMenuOpen) {
        window.electronAPI?.resizeMainWindow?.("WITH_MENU");
      } else if (toastCount > 0) {
        window.electronAPI?.resizeMainWindow?.("WITH_TOAST");
      } else {
        window.electronAPI?.resizeMainWindow?.("BASE");
      }
    };
    resizeWindow();
  }, [isCommandMenuOpen, toastCount]);

  const handleDictationToggle = React.useCallback(() => {
    setIsCommandMenuOpen(false);
    setWindowInteractivity(false);
  }, [setWindowInteractivity]);

  const { isRecording, isProcessing, toggleListening, cancelRecording, cancelProcessing } =
    useAudioRecording(toast, {
      onToggle: handleDictationToggle,
    });

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

  const getMicState = () => {
    if (isRecording) return "recording";
    if (isProcessing) return "processing";
    if (isHovered && !isRecording && !isProcessing) return "hover";
    return "idle";
  };

  const micState = getMicState();

  // Inline styles for the mic button — gives precise control over the glassmorphism + glow effects
  const getMicButtonStyles = () => {
    const base = {
      width: 44,
      height: 44,
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      overflow: "hidden",
      cursor: "pointer",
      transition: "all 300ms cubic-bezier(0.4, 0, 0.2, 1)",
    };

    switch (micState) {
      case "idle":
        return {
          ...base,
          backgroundColor: "rgba(8, 9, 8, 0.7)",
          border: "1.5px solid #222523",
          boxShadow: "none",
          backdropFilter: "blur(12px)",
        };
      case "hover":
        return {
          ...base,
          backgroundColor: "rgba(8, 9, 8, 0.8)",
          border: "1.5px solid rgba(112, 255, 186, 0.3)",
          boxShadow: "0 0 20px rgba(112, 255, 186, 0.1)",
          backdropFilter: "blur(12px)",
        };
      case "recording":
        return {
          ...base,
          backgroundColor: "#70FFBA",
          border: "1.5px solid rgba(112, 255, 186, 0.5)",
          boxShadow: "0 0 24px rgba(112, 255, 186, 0.2)",
          cursor: "pointer",
        };
      case "processing":
        return {
          ...base,
          backgroundColor: "#1A2E26",
          border: "1.5px solid rgba(112, 255, 186, 0.15)",
          boxShadow: "none",
          cursor: "not-allowed",
        };
      default:
        return base;
    }
  };

  return (
    <div className="dictation-window">
      {/* Ambient mint glow behind button during recording */}
      {micState === "recording" && (
        <div
          className="fixed bottom-0 right-0 pointer-events-none"
          style={{
            width: 200,
            height: 200,
            background:
              "radial-gradient(circle at center, rgba(112, 255, 186, 0.06) 0%, transparent 70%)",
          }}
        />
      )}

      <div className="fixed bottom-6 right-6 z-50">
        <div
          className="relative flex items-center gap-2"
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
        >
          {/* Cancel button */}
          {(isRecording || isProcessing) && isHovered && (
            <button
              aria-label={isRecording ? "Cancel recording" : "Cancel processing"}
              onClick={(e) => {
                e.stopPropagation();
                isRecording ? cancelRecording() : cancelProcessing();
              }}
              className="w-5 h-5 rounded-full bg-surface-1/90 hover:bg-[#FF6B6B] border border-border-subtle hover:border-[#FF6B6B] flex items-center justify-center transition-all duration-150 shadow-elevated backdrop-blur-sm"
            >
              <X size={10} strokeWidth={2.5} color="white" />
            </button>
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
            onFocus={() => setIsHovered(true)}
            onBlur={() => setIsHovered(false)}
            style={{
              ...getMicButtonStyles(),
              cursor:
                micState === "processing"
                  ? "not-allowed"
                  : isDragging
                    ? "grabbing"
                    : "pointer",
            }}
          >
            {/* Content based on state */}
            {micState === "idle" || micState === "hover" ? (
              <SoundWaveIcon size={micState === "idle" ? 13 : 15} />
            ) : micState === "recording" ? (
              <LoadingDots />
            ) : micState === "processing" ? (
              <VoiceWaveIndicator isListening={true} />
            ) : null}

            {/* Recording pulse ring */}
            {micState === "recording" && (
              <div
                className="absolute inset-0 rounded-full border-2 border-[#70FFBA]/40"
                style={{ animation: "ring-pulse 2s ease-in-out infinite" }}
              />
            )}

            {/* Processing indicator ring */}
            {micState === "processing" && (
              <div className="absolute inset-0 rounded-full border border-[#70FFBA]/15" />
            )}
          </button>

          {/* Command menu */}
          {isCommandMenuOpen && (
            <div
              ref={commandMenuRef}
              className="absolute bottom-full right-0 mb-3 w-48 rounded-lg border border-border-subtle bg-popover/95 text-popover-foreground shadow-elevated backdrop-blur-xl"
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
                className="w-full px-3 py-2.5 text-left text-sm font-medium hover:bg-primary/8 focus:bg-primary/8 focus:outline-none transition-colors rounded-t-lg"
                onClick={() => {
                  toggleListening();
                }}
              >
                {isRecording ? "Stop listening" : "Start listening"}
              </button>
              <div className="h-px bg-border-subtle mx-2" />
              <button
                className="w-full px-3 py-2.5 text-left text-sm text-muted-foreground hover:text-foreground hover:bg-primary/8 focus:bg-primary/8 focus:outline-none transition-colors rounded-b-lg"
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
    </div>
  );
}
