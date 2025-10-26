import { useState, useEffect, useRef } from "react";
import AudioManager from "../helpers/audioManager";

export const useAudioRecording = (toast) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const audioManagerRef = useRef(null);

  useEffect(() => {
    // Initialize AudioManager
    audioManagerRef.current = new AudioManager();

    // Set up callbacks
    audioManagerRef.current.setCallbacks({
      onStateChange: ({ isRecording, isProcessing }) => {
        setIsRecording(isRecording);
        setIsProcessing(isProcessing);
      },
      onError: (error) => {
        toast({
          title: error.title,
          description: error.description,
          variant: "destructive",
        });
      },
      onTranscriptionComplete: async (result) => {
        if (result.success) {
          setTranscript(result.text);

          // Paste immediately
          await audioManagerRef.current.safePaste(result.text);

          // Save to database in parallel
          audioManagerRef.current.saveTranscription(result.text);

          // Show success notification if local fallback was used
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

    // Set up hotkey listener
    let recording = false;
    const handleToggle = () => {
      const currentState = audioManagerRef.current.getState();

      if (!recording && !currentState.isRecording && !currentState.isProcessing) {
        audioManagerRef.current.startRecording();
        recording = true;
      } else if (currentState.isRecording) {
        audioManagerRef.current.stopRecording();
        recording = false;
      }
    };

    window.electronAPI.onToggleDictation(handleToggle);

    // Set up no-audio-detected listener
    const handleNoAudioDetected = () => {
      toast({
        title: "No Audio Detected",
        description: "The recording contained no detectable audio. Please try again.",
        variant: "default",
      });
    };

    window.electronAPI.onNoAudioDetected?.(handleNoAudioDetected);

    // Cleanup
    return () => {
      if (audioManagerRef.current) {
        audioManagerRef.current.cleanup();
      }
    };
  }, [toast]);

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
    startRecording,
    stopRecording,
    toggleListening,
  };
};
