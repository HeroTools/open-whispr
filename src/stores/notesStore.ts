import { useSyncExternalStore } from "react";
import type { NoteItem } from "../types/electron";

type Listener = () => void;

const listeners = new Set<Listener>();
let notes: NoteItem[] = [];
let hasBoundIpcListeners = false;
const DEFAULT_LIMIT = 100;
let currentLimit = DEFAULT_LIMIT;

const emit = () => {
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: Listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => notes;

function ensureIpcListeners() {
  if (hasBoundIpcListeners || typeof window === "undefined") {
    return;
  }

  const disposers: Array<() => void> = [];

  if (window.electronAPI?.onNoteAdded) {
    const dispose = window.electronAPI.onNoteAdded((note) => {
      if (note) {
        addNote(note);
      }
    });
    if (typeof dispose === "function") {
      disposers.push(dispose);
    }
  }

  if (window.electronAPI?.onNoteUpdated) {
    const dispose = window.electronAPI.onNoteUpdated((note) => {
      if (note) {
        updateNoteInStore(note);
      }
    });
    if (typeof dispose === "function") {
      disposers.push(dispose);
    }
  }

  if (window.electronAPI?.onNoteDeleted) {
    const dispose = window.electronAPI.onNoteDeleted(({ id }) => {
      removeNote(id);
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

export async function initializeNotes(limit = DEFAULT_LIMIT) {
  currentLimit = limit;
  ensureIpcListeners();
  const items = await window.electronAPI.getNotes(limit);
  notes = items;
  emit();
  return items;
}

export function addNote(note: NoteItem) {
  if (!note) return;
  // Remove duplicate if exists, then add to top
  const withoutDuplicate = notes.filter((existing) => existing.id !== note.id);
  notes = [note, ...withoutDuplicate].slice(0, currentLimit);
  // Sort by pinned first, then by updated_at
  notes.sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) {
      return b.is_pinned - a.is_pinned;
    }
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
  emit();
}

export function updateNoteInStore(note: NoteItem) {
  if (!note) return;
  const index = notes.findIndex((n) => n.id === note.id);
  if (index === -1) {
    // Note not in store, add it
    addNote(note);
    return;
  }
  notes = notes.map((n) => (n.id === note.id ? note : n));
  // Re-sort after update
  notes.sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) {
      return b.is_pinned - a.is_pinned;
    }
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
  emit();
}

export function removeNote(id: number) {
  if (!id) return;
  const next = notes.filter((note) => note.id !== id);
  if (next.length === notes.length) return;
  notes = next;
  emit();
}

export function clearNotes() {
  if (notes.length === 0) return;
  notes = [];
  emit();
}

export function useNotes() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// Selector for getting a single note by ID
export function useNote(id: number | null) {
  const allNotes = useNotes();
  if (id === null) return null;
  return allNotes.find((note) => note.id === id) || null;
}
