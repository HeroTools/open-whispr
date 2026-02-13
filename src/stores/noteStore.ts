import { useSyncExternalStore } from "react";
import type { NoteItem } from "../types/electron";

type Listener = () => void;

const listeners = new Set<Listener>();
let notes: NoteItem[] = [];
let activeNoteId: number | null = null;
let activeFolderId: number | null = null;
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

const getNotesSnapshot = () => notes;
const getActiveNoteIdSnapshot = () => activeNoteId;
const getActiveFolderIdSnapshot = () => activeFolderId;

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

export async function initializeNotes(
  noteType?: string | null,
  limit = DEFAULT_LIMIT,
  folderId?: number | null
): Promise<NoteItem[]> {
  currentLimit = limit;
  ensureIpcListeners();
  const items = await window.electronAPI.getNotes(noteType, limit, folderId);
  notes = items;
  emit();
  return items;
}

export function addNote(note: NoteItem): void {
  if (!note) return;
  if (activeFolderId && note.folder_id !== activeFolderId) return;
  const withoutDuplicate = notes.filter((existing) => existing.id !== note.id);
  notes = [note, ...withoutDuplicate].slice(0, currentLimit);
  emit();
}

export function updateNoteInStore(note: NoteItem): void {
  if (!note) return;
  notes = notes.map((existing) => (existing.id === note.id ? note : existing));
  emit();
}

export function removeNote(id: number): void {
  if (!id) return;
  const next = notes.filter((item) => item.id !== id);
  if (next.length === notes.length) return;
  notes = next;
  emit();
}

export function setActiveNoteId(id: number | null): void {
  if (activeNoteId === id) return;
  activeNoteId = id;
  emit();
}

export function setActiveFolderId(id: number | null): void {
  if (activeFolderId === id) return;
  activeFolderId = id;
  emit();
}

export function getActiveFolderIdValue(): number | null {
  return activeFolderId;
}

export function useNotes(): NoteItem[] {
  return useSyncExternalStore(subscribe, getNotesSnapshot, getNotesSnapshot);
}

export function useActiveNoteId(): number | null {
  return useSyncExternalStore(subscribe, getActiveNoteIdSnapshot, getActiveNoteIdSnapshot);
}

export function useActiveFolderId(): number | null {
  return useSyncExternalStore(subscribe, getActiveFolderIdSnapshot, getActiveFolderIdSnapshot);
}
