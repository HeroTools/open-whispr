import { useSyncExternalStore } from "react";
import type { TranscriptionItem } from "../types/electron";

type Listener = () => void;

const listeners = new Set<Listener>();
let transcriptions: TranscriptionItem[] = [];
let hasBoundIpcListeners = false;
const DEFAULT_LIMIT = 50;
let currentLimit = DEFAULT_LIMIT;

const emit = () => {
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: Listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => transcriptions;

function ensureIpcListeners() {
  if (hasBoundIpcListeners || typeof window === "undefined") {
    return;
  }

  const disposers: Array<() => void> = [];

  if (window.electronAPI?.onTranscriptionAdded) {
    const dispose = window.electronAPI.onTranscriptionAdded((item) => {
      if (item) {
        addTranscription(item);
      }
    });
    if (typeof dispose === "function") {
      disposers.push(dispose);
    }
  }

  if (window.electronAPI?.onTranscriptionDeleted) {
    const dispose = window.electronAPI.onTranscriptionDeleted(({ id }) => {
      removeTranscription(id);
    });
    if (typeof dispose === "function") {
      disposers.push(dispose);
    }
  }

  if (window.electronAPI?.onTranscriptionsCleared) {
    const dispose = window.electronAPI.onTranscriptionsCleared(() => {
      clearTranscriptions();
    });
    if (typeof dispose === "function") {
      disposers.push(dispose);
    }
  }

  hasBoundIpcListeners = true;

  window.addEventListener("beforeunload", () => {
    disposers.forEach((dispose) => dispose());
  });
}

export async function initializeTranscriptions(limit = DEFAULT_LIMIT) {
  currentLimit = limit;
  ensureIpcListeners();
  const items = await window.electronAPI.getTranscriptions(limit);
  transcriptions = items;
  emit();
  return items;
}

export function addTranscription(item: TranscriptionItem) {
  if (!item) return;
  const withoutDuplicate = transcriptions.filter(
    (existing) => existing.id !== item.id
  );
  transcriptions = [item, ...withoutDuplicate].slice(0, currentLimit);
  emit();
}

export function removeTranscription(id: number) {
  if (!id) return;
  const next = transcriptions.filter((item) => item.id !== id);
  if (next.length === transcriptions.length) return;
  transcriptions = next;
  emit();
}

export function clearTranscriptions() {
  if (transcriptions.length === 0) return;
  transcriptions = [];
  emit();
}

export function useTranscriptions() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
