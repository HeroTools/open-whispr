import { useState, useEffect, useRef } from "react";
import AudioManager from "../helpers/audioManager";

export const useAudioRecording = (toast, options = {}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [partialTranscript, setPartialTranscript] = useState("");
  const audioManagerRef = useRef(null);
  const { onToggle } = options;

  useEffect(() => {
    audioManagerRef.current = new AudioManager();

    audioManagerRef.current.setCallbacks({
      onStateChange: ({ isRecording, isProcessing, isStreaming }) => {
        setIsRecording(isRecording);
        setIsProcessing(isProcessing);
        setIsStreaming(isStreaming ?? false);
        if (!isStreaming) {
          setPartialTranscript("");
        }
      },
      onError: (error) => {
        // Provide specific titles for cloud error codes
        const title =
          error.code === "AUTH_EXPIRED"
            ? "Session Expired"
            : error.code === "OFFLINE"
              ? "You're Offline"
              : error.code === "LIMIT_REACHED"
                ? "Daily Limit Reached"
                : error.title;

        toast({
          title,
          description: error.description,
          variant: "destructive",
          duration: error.code === "AUTH_EXPIRED" ? 8000 : undefined,
        });
      },
      onPartialTranscript: (text) => {
        setPartialTranscript(text);
      },
      onTranscriptionComplete: async (result) => {
        if (result.success) {
          setTranscript(result.text);

          await audioManagerRef.current.safePaste(result.text);

          audioManagerRef.current.saveTranscription(result.text);

          if (result.source === "openai" && localStorage.getItem("useLocalWhisper") === "true") {
            toast({
              title: "Fallback Mode",
              description: "Local Whisper failed. Used OpenAI API instead.",
              variant: "default",
            });
          }

          // Cloud usage: limit reached after this transcription
          if (result.source === "openwhispr" && result.limitReached) {
            // Notify control panel to show UpgradePrompt dialog
            window.electronAPI?.notifyLimitReached?.({
              wordsUsed: result.wordsUsed,
              limit:
                result.wordsRemaining !== undefined
                  ? result.wordsUsed + result.wordsRemaining
                  : 2000,
            });
          }

          audioManagerRef.current.warmupStreamingConnection();
        }
      },
    });

    audioManagerRef.current.warmupStreamingConnection();

    const handleToggle = async () => {
      const currentState = audioManagerRef.current.getState();

      if (!currentState.isRecording && !currentState.isProcessing) {
        if (audioManagerRef.current.shouldUseStreaming()) {
          await audioManagerRef.current.startStreamingRecording();
        } else {
          await audioManagerRef.current.startRecording();
        }
      } else if (currentState.isRecording) {
        if (currentState.isStreaming) {
          await audioManagerRef.current.stopStreamingRecording();
        } else {
          audioManagerRef.current.stopRecording();
        }
      }
    };

    const handleStart = async () => {
      const currentState = audioManagerRef.current.getState();
      if (!currentState.isRecording && !currentState.isProcessing) {
        if (audioManagerRef.current.shouldUseStreaming()) {
          await audioManagerRef.current.startStreamingRecording();
        } else {
          await audioManagerRef.current.startRecording();
        }
      }
    };

    const handleStop = async () => {
      const currentState = audioManagerRef.current.getState();
      if (currentState.isRecording) {
        if (currentState.isStreaming) {
          await audioManagerRef.current.stopStreamingRecording();
        } else {
          audioManagerRef.current.stopRecording();
        }
      }
    };

    const disposeToggle = window.electronAPI.onToggleDictation(() => {
      handleToggle();
      onToggle?.();
    });

    const disposeStart = window.electronAPI.onStartDictation?.(() => {
      handleStart();
      onToggle?.();
    });

    const disposeStop = window.electronAPI.onStopDictation?.(() => {
      handleStop();
      onToggle?.();
    });

    const handleNoAudioDetected = () => {
      toast({
        title: "No Audio Detected",
        description: "The recording contained no detectable audio. Please try again.",
        variant: "default",
      });
    };

    const disposeNoAudio = window.electronAPI.onNoAudioDetected?.(handleNoAudioDetected);

    // Cleanup
    return () => {
      disposeToggle?.();
      disposeStart?.();
      disposeStop?.();
      disposeNoAudio?.();
      if (audioManagerRef.current) {
        audioManagerRef.current.cleanup();
      }
    };
  }, [toast, onToggle]);

  const startRecording = async () => {
    if (audioManagerRef.current) {
      if (audioManagerRef.current.shouldUseStreaming()) {
        return await audioManagerRef.current.startStreamingRecording();
      }
      return await audioManagerRef.current.startRecording();
    }
    return false;
  };

  const stopRecording = async () => {
    if (audioManagerRef.current) {
      const state = audioManagerRef.current.getState();
      if (state.isStreaming) {
        return await audioManagerRef.current.stopStreamingRecording();
      }
      return audioManagerRef.current.stopRecording();
    }
    return false;
  };

  const cancelRecording = async () => {
    if (audioManagerRef.current) {
      const state = audioManagerRef.current.getState();
      if (state.isStreaming) {
        return await audioManagerRef.current.stopStreamingRecording();
      }
      return audioManagerRef.current.cancelRecording();
    }
    return false;
  };

  const cancelProcessing = () => {
    if (audioManagerRef.current) {
      return audioManagerRef.current.cancelProcessing();
    }
    return false;
  };

  const toggleListening = async () => {
    if (!isRecording && !isProcessing) {
      await startRecording();
    } else if (isRecording) {
      await stopRecording();
    }
  };

  return {
    isRecording,
    isProcessing,
    isStreaming,
    transcript,
    partialTranscript,
    startRecording,
    stopRecording,
    cancelRecording,
    cancelProcessing,
    toggleListening,
  };
};
