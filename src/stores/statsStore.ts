import { useSyncExternalStore } from "react";
import type { DashboardStats } from "../types/electron";

type Listener = () => void;

const listeners = new Set<Listener>();
let stats: DashboardStats = {
  totalWords: 0,
  totalTranscriptions: 0,
  averageWpm: 0,
  streak: 0,
};

const emit = () => {
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: Listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => stats;

export async function initializeStats(): Promise<DashboardStats> {
  const newStats = await window.electronAPI.getDashboardStats();
  stats = newStats;
  emit();
  return newStats;
}

export async function refreshStats(): Promise<DashboardStats> {
  return initializeStats();
}

export function useStats(): DashboardStats {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
