import { useState, useEffect, useRef } from "react";
import AudioManager from "../helpers/audioManager";

export const useAudioRecording = (toast, options = {}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [partialTranscript, setPartialTranscript] = useState("");
  const partialTranscriptRef = useRef("");
  const rafIdRef = useRef(null);
  const audioManagerRef = useRef(null);
  const { onToggle } = options;

  useEffect(() => {
    audioManagerRef.current = new AudioManager();

    const clearPartialTranscript = () => {
      partialTranscriptRef.current = "";
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      setPartialTranscript("");
    };

    const schedulePartialTranscriptUpdate = () => {
      if (rafIdRef.current !== null) {
        return;
      }
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        setPartialTranscript(partialTranscriptRef.current);
      });
    };

    audioManagerRef.current.setCallbacks({
      onStateChange: ({ isRecording, isProcessing }) => {
        setIsRecording(isRecording);
        setIsProcessing(isProcessing);
        if (isRecording) {
          clearPartialTranscript();
        }
      },
      onError: (error) => {
        clearPartialTranscript();
        toast({
          title: error.title,
          description: error.description,
          variant: "destructive",
        });
      },
      onPartialTranscript: (text) => {
        partialTranscriptRef.current = text;
        schedulePartialTranscriptUpdate();
      },
      onTranscriptionComplete: async (result) => {
        clearPartialTranscript();
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
        }
      },
    });

    // Set up hotkey listener for tap-to-talk mode
    const handleToggle = () => {
      const currentState = audioManagerRef.current.getState();

      if (!currentState.isRecording && !currentState.isProcessing) {
        audioManagerRef.current.startRecording();
      } else if (currentState.isRecording) {
        audioManagerRef.current.stopRecording();
      }
    };

    // Set up listener for push-to-talk start
    const handleStart = () => {
      const currentState = audioManagerRef.current.getState();
      if (!currentState.isRecording && !currentState.isProcessing) {
        audioManagerRef.current.startRecording();
      }
    };

    // Set up listener for push-to-talk stop
    const handleStop = () => {
      const currentState = audioManagerRef.current.getState();
      if (currentState.isRecording) {
        audioManagerRef.current.stopRecording();
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
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [toast, onToggle]);

  const startRecording = async () => {
    if (audioManagerRef.current) {
      return await audioManagerRef.current.startRecording();
    }
    return false;
  };

  const stopRecording = () => {
    if (audioManagerRef.current) {
      return audioManagerRef.current.stopRecording();
    }
    return false;
  };

  const cancelRecording = () => {
    if (audioManagerRef.current) {
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

  const toggleListening = () => {
    if (!isRecording && !isProcessing) {
      startRecording();
    } else if (isRecording) {
      stopRecording();
    }
  };

  return {
    isRecording,
    isProcessing,
    transcript,
    partialTranscript,
    startRecording,
    stopRecording,
    cancelRecording,
    cancelProcessing,
    toggleListening,
  };
};
