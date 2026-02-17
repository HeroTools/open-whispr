import { useSyncExternalStore } from "react";
import type { ActionItem } from "../types/electron";

type Listener = () => void;

const listeners = new Set<Listener>();
let actions: ActionItem[] = [];
let hasBoundIpcListeners = false;

const emit = () => {
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: Listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getActionsSnapshot = () => actions;

function ensureIpcListeners() {
  if (hasBoundIpcListeners || typeof window === "undefined") return;

  const disposers: Array<() => void> = [];

  if (window.electronAPI?.onActionCreated) {
    const dispose = window.electronAPI.onActionCreated((action) => {
      if (action) addActionToStore(action);
    });
    if (typeof dispose === "function") disposers.push(dispose);
  }

  if (window.electronAPI?.onActionUpdated) {
    const dispose = window.electronAPI.onActionUpdated((action) => {
      if (action) updateActionInStore(action);
    });
    if (typeof dispose === "function") disposers.push(dispose);
  }

  if (window.electronAPI?.onActionDeleted) {
    const dispose = window.electronAPI.onActionDeleted(({ id }) => {
      removeActionFromStore(id);
    });
    if (typeof dispose === "function") disposers.push(dispose);
  }

  hasBoundIpcListeners = true;
  window.addEventListener("beforeunload", () => {
    disposers.forEach((dispose) => dispose());
  });
}

export async function initializeActions(): Promise<ActionItem[]> {
  ensureIpcListeners();
  const items = await window.electronAPI.getActions();
  actions = items;
  emit();
  return items;
}

function addActionToStore(action: ActionItem): void {
  const withoutDuplicate = actions.filter((a) => a.id !== action.id);
  actions = [...withoutDuplicate, action].sort((a, b) => a.sort_order - b.sort_order);
  emit();
}

function updateActionInStore(action: ActionItem): void {
  actions = actions.map((a) => (a.id === action.id ? action : a));
  emit();
}

function removeActionFromStore(id: number): void {
  const next = actions.filter((a) => a.id !== id);
  if (next.length === actions.length) return;
  actions = next;
  emit();
}

export function useActions(): ActionItem[] {
  return useSyncExternalStore(subscribe, getActionsSnapshot, getActionsSnapshot);
}
