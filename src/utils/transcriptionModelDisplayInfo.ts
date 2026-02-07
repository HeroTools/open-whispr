import {
  WHISPER_MODEL_INFO,
  PARAKEET_MODEL_INFO,
  type WhisperModelInfo,
  type ParakeetModelInfo,
} from "../models/ModelRegistry";

export type WhisperModelDisplayInfo = Pick<
  WhisperModelInfo,
  "name" | "description" | "size" | "recommended"
>;

export type ParakeetModelDisplayInfo = Pick<
  ParakeetModelInfo,
  "name" | "description" | "size" | "language" | "recommended"
>;

export function getWhisperModelDisplayInfo(modelId: string): WhisperModelDisplayInfo {
  const info = WHISPER_MODEL_INFO[modelId];
  if (info) return info;
  return {
    name: modelId,
    description: "Model",
    size: "Unknown",
  };
}

export function getParakeetModelDisplayInfo(modelId: string): ParakeetModelDisplayInfo {
  const info = PARAKEET_MODEL_INFO[modelId];
  if (info) return info;
  return {
    name: modelId,
    description: "NVIDIA Parakeet Model",
    size: "Unknown",
    language: "en",
  };
}
