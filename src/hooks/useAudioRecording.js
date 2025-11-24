import { useState, useEffect, useRef } from "react";
import AudioManager from "../helpers/audioManager";
import TranslationService from "../services/TranslationService";
import { getModelProvider } from "../utils/languages";

export const useAudioRecording = (toast, options = {}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [audioStream, setAudioStream] = useState(null);
  const audioManagerRef = useRef(null);
  const {
    onToggle,
    enableTranslation,
    targetLanguage,
    preferredLanguage,
    translationModel,
    openaiApiKey,
    anthropicApiKey,
    geminiApiKey,
  } = options;

  useEffect(() => {
    // Initialize AudioManager
    audioManagerRef.current = new AudioManager();

    // Set up callbacks
    audioManagerRef.current.setCallbacks({
      onStateChange: ({ isRecording, isProcessing }) => {
        setIsRecording(isRecording);
        setIsProcessing(isProcessing);
      },
      onStreamReady: (stream) => {
        setAudioStream(stream);
      },
      onStreamEnded: () => {
        setAudioStream(null);
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
          let finalText = result.text;

          // Handle translation if enabled
          if (enableTranslation && targetLanguage && targetLanguage !== preferredLanguage) {
            try {
              const provider = getModelProvider(translationModel);
              let apiKey = "";

              if (provider === "openai") {
                apiKey = openaiApiKey;
              } else if (provider === "anthropic") {
                apiKey = anthropicApiKey;
              } else if (provider === "gemini") {
                apiKey = geminiApiKey;
              }

              if (apiKey) {
                const translationResult = await TranslationService.translate({
                  text: result.text,
                  sourceLanguage: preferredLanguage,
                  targetLanguage: targetLanguage,
                  provider: provider,
                  apiKey: apiKey,
                  model: translationModel,
                });

                if (translationResult.success) {
                  finalText = translationResult.translatedText;
                } else {
                  toast({
                    title: "Translation Failed",
                    description: translationResult.error || "Using original text",
                    variant: "destructive",
                  });
                }
              } else {
                toast({
                  title: "Translation Skipped",
                  description: `No API key found for ${provider}. Using original text.`,
                  variant: "default",
                });
              }
            } catch (error) {
              console.error("Translation error:", error);
              toast({
                title: "Translation Error",
                description: `Failed to translate: ${error.message}`,
                variant: "destructive",
              });
            }
          }

          setTranscript(finalText);

          // Paste immediately
          await audioManagerRef.current.safePaste(finalText);

          // Save to database in parallel
          audioManagerRef.current.saveTranscription(finalText);

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

    const disposeToggle = window.electronAPI.onToggleDictation(() => {
      handleToggle();
      onToggle?.();
    });

    // Set up no-audio-detected listener
    const handleNoAudioDetected = () => {
      toast({
        title: "No Audio Detected",
        description: "The recording contained no detectable audio. Please try again.",
        variant: "default",
      });
    };

    const disposeNoAudio = window.electronAPI.onNoAudioDetected?.(
      handleNoAudioDetected
    );

    // Cleanup
    return () => {
      disposeToggle?.();
      disposeNoAudio?.();
      if (audioManagerRef.current) {
        audioManagerRef.current.cleanup();
      }
      setAudioStream(null);
    };
  }, [toast, onToggle, enableTranslation, targetLanguage, preferredLanguage, translationModel, openaiApiKey, anthropicApiKey, geminiApiKey]);

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
    audioStream,
    startRecording,
    stopRecording,
    toggleListening,
  };
};
