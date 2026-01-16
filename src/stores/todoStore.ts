import { useSyncExternalStore } from "react";
import type { TodoItem, Project, Tag, TodoFilters, TodoStats } from "../types/todo";

type Listener = () => void;

// ==================== TODOS STORE ====================
const todoListeners = new Set<Listener>();
let todos: TodoItem[] = [];
let hasBoundTodoListeners = false;
const DEFAULT_LIMIT = 100;
let currentFilters: TodoFilters = { limit: DEFAULT_LIMIT };

const emitTodos = () => {
  todoListeners.forEach((listener) => listener());
};

const subscribeTodos = (listener: Listener) => {
  todoListeners.add(listener);
  return () => todoListeners.delete(listener);
};

const getTodosSnapshot = () => todos;

// ==================== PROJECTS STORE ====================
const projectListeners = new Set<Listener>();
let projects: Project[] = [];
let hasBoundProjectListeners = false;

const emitProjects = () => {
  projectListeners.forEach((listener) => listener());
};

const subscribeProjects = (listener: Listener) => {
  projectListeners.add(listener);
  return () => projectListeners.delete(listener);
};

const getProjectsSnapshot = () => projects;

// ==================== TAGS STORE ====================
const tagListeners = new Set<Listener>();
let tags: Tag[] = [];
let hasBoundTagListeners = false;

const emitTags = () => {
  tagListeners.forEach((listener) => listener());
};

const subscribeTags = (listener: Listener) => {
  tagListeners.add(listener);
  return () => tagListeners.delete(listener);
};

const getTagsSnapshot = () => tags;

// ==================== STATS STORE ====================
const statsListeners = new Set<Listener>();
let stats: TodoStats = { total: 0, completed: 0, pending: 0, urgent: 0, overdue: 0 };

const emitStats = () => {
  statsListeners.forEach((listener) => listener());
};

const subscribeStats = (listener: Listener) => {
  statsListeners.add(listener);
  return () => statsListeners.delete(listener);
};

const getStatsSnapshot = () => stats;

// ==================== IPC LISTENERS ====================
function ensureTodoIpcListeners() {
  if (hasBoundTodoListeners || typeof window === "undefined") {
    return;
  }

  const disposers: Array<() => void> = [];

  if (window.electronAPI?.onTodoAdded) {
    const dispose = window.electronAPI.onTodoAdded((todo) => {
      if (todo) {
        addTodo(todo);
        refreshStats();
      }
    });
    if (typeof dispose === "function") {
      disposers.push(dispose);
    }
  }

  if (window.electronAPI?.onTodoUpdated) {
    const dispose = window.electronAPI.onTodoUpdated((todo) => {
      if (todo) {
        updateTodoInStore(todo);
        refreshStats();
      }
    });
    if (typeof dispose === "function") {
      disposers.push(dispose);
    }
  }

  if (window.electronAPI?.onTodoDeleted) {
    const dispose = window.electronAPI.onTodoDeleted(({ id }) => {
      removeTodo(id);
      refreshStats();
    });
    if (typeof dispose === "function") {
      disposers.push(dispose);
    }
  }

  hasBoundTodoListeners = true;

  window.addEventListener("beforeunload", () => {
    disposers.forEach((dispose) => dispose());
  });
}

function ensureProjectIpcListeners() {
  if (hasBoundProjectListeners || typeof window === "undefined") {
    return;
  }

  const disposers: Array<() => void> = [];

  if (window.electronAPI?.onProjectAdded) {
    const dispose = window.electronAPI.onProjectAdded((project) => {
      if (project) {
        addProject(project);
      }
    });
    if (typeof dispose === "function") {
      disposers.push(dispose);
    }
  }

  if (window.electronAPI?.onProjectUpdated) {
    const dispose = window.electronAPI.onProjectUpdated((project) => {
      if (project) {
        updateProjectInStore(project);
      }
    });
    if (typeof dispose === "function") {
      disposers.push(dispose);
    }
  }

  if (window.electronAPI?.onProjectDeleted) {
    const dispose = window.electronAPI.onProjectDeleted(({ id }) => {
      removeProject(id);
    });
    if (typeof dispose === "function") {
      disposers.push(dispose);
    }
  }

  hasBoundProjectListeners = true;

  window.addEventListener("beforeunload", () => {
    disposers.forEach((dispose) => dispose());
  });
}

function ensureTagIpcListeners() {
  if (hasBoundTagListeners || typeof window === "undefined") {
    return;
  }

  const disposers: Array<() => void> = [];

  if (window.electronAPI?.onTagAdded) {
    const dispose = window.electronAPI.onTagAdded((tag) => {
      if (tag) {
        addTag(tag);
      }
    });
    if (typeof dispose === "function") {
      disposers.push(dispose);
    }
  }

  if (window.electronAPI?.onTagUpdated) {
    const dispose = window.electronAPI.onTagUpdated((tag) => {
      if (tag) {
        updateTagInStore(tag);
      }
    });
    if (typeof dispose === "function") {
      disposers.push(dispose);
    }
  }

  if (window.electronAPI?.onTagDeleted) {
    const dispose = window.electronAPI.onTagDeleted(({ id }) => {
      removeTag(id);
    });
    if (typeof dispose === "function") {
      disposers.push(dispose);
    }
  }

  hasBoundTagListeners = true;

  window.addEventListener("beforeunload", () => {
    disposers.forEach((dispose) => dispose());
  });
}

// ==================== TODO OPERATIONS ====================
export async function initializeTodos(filters: TodoFilters = { limit: DEFAULT_LIMIT }) {
  currentFilters = filters;
  ensureTodoIpcListeners();
  const result = await window.electronAPI.getTodos(filters);
  if (result.success && result.todos) {
    todos = result.todos;
    emitTodos();
  }
  return result.todos || [];
}

export function addTodo(todo: TodoItem) {
  if (!todo) return;
  const withoutDuplicate = todos.filter((existing) => existing.id !== todo.id);
  todos = [todo, ...withoutDuplicate].slice(0, currentFilters.limit || DEFAULT_LIMIT);
  emitTodos();
}

export function updateTodoInStore(todo: TodoItem) {
  if (!todo) return;
  const index = todos.findIndex((t) => t.id === todo.id);
  if (index !== -1) {
    todos = [...todos.slice(0, index), todo, ...todos.slice(index + 1)];
    emitTodos();
  }
}

export function removeTodo(id: number) {
  if (!id) return;
  const next = todos.filter((todo) => todo.id !== id);
  if (next.length === todos.length) return;
  todos = next;
  emitTodos();
}

// ==================== PROJECT OPERATIONS ====================
export async function initializeProjects() {
  ensureProjectIpcListeners();
  const result = await window.electronAPI.getProjects();
  if (result.success && result.projects) {
    projects = result.projects;
    emitProjects();
  }
  return result.projects || [];
}

export function addProject(project: Project) {
  if (!project) return;
  const withoutDuplicate = projects.filter((existing) => existing.id !== project.id);
  projects = [...withoutDuplicate, project].sort((a, b) => a.name.localeCompare(b.name));
  emitProjects();
}

export function updateProjectInStore(project: Project) {
  if (!project) return;
  const index = projects.findIndex((p) => p.id === project.id);
  if (index !== -1) {
    projects = [...projects.slice(0, index), project, ...projects.slice(index + 1)];
    emitProjects();
  }
}

export function removeProject(id: number) {
  if (!id) return;
  const next = projects.filter((project) => project.id !== id);
  if (next.length === projects.length) return;
  projects = next;
  emitProjects();
}

// ==================== TAG OPERATIONS ====================
export async function initializeTags() {
  ensureTagIpcListeners();
  const result = await window.electronAPI.getTags();
  if (result.success && result.tags) {
    tags = result.tags;
    emitTags();
  }
  return result.tags || [];
}

export function addTag(tag: Tag) {
  if (!tag) return;
  const withoutDuplicate = tags.filter((existing) => existing.id !== tag.id);
  tags = [...withoutDuplicate, tag].sort((a, b) => a.name.localeCompare(b.name));
  emitTags();
}

export function updateTagInStore(tag: Tag) {
  if (!tag) return;
  const index = tags.findIndex((t) => t.id === tag.id);
  if (index !== -1) {
    tags = [...tags.slice(0, index), tag, ...tags.slice(index + 1)];
    emitTags();
  }
}

export function removeTag(id: number) {
  if (!id) return;
  const next = tags.filter((tag) => tag.id !== id);
  if (next.length === tags.length) return;
  tags = next;
  emitTags();
}

// ==================== STATS OPERATIONS ====================
export async function refreshStats() {
  const result = await window.electronAPI.getTodoStats();
  if (result.success && result.stats) {
    stats = result.stats;
    emitStats();
  }
  return result.stats;
}

// ==================== HOOKS ====================
export function useTodos() {
  return useSyncExternalStore(subscribeTodos, getTodosSnapshot, getTodosSnapshot);
}

export function useProjects() {
  return useSyncExternalStore(subscribeProjects, getProjectsSnapshot, getProjectsSnapshot);
}

export function useTags() {
  return useSyncExternalStore(subscribeTags, getTagsSnapshot, getTagsSnapshot);
}

export function useTodoStats() {
  return useSyncExternalStore(subscribeStats, getStatsSnapshot, getStatsSnapshot);
}

// ==================== HELPER FUNCTIONS ====================
export function getTodosByProject(projectId: number | null): TodoItem[] {
  if (projectId === null) {
    return todos.filter((t) => t.project_id === null);
  }
  return todos.filter((t) => t.project_id === projectId);
}

export function getPendingTodos(): TodoItem[] {
  return todos.filter((t) => !t.completed);
}

export function getCompletedTodos(): TodoItem[] {
  return todos.filter((t) => t.completed);
}

export function getOverdueTodos(): TodoItem[] {
  const now = new Date();
  return todos.filter((t) => !t.completed && t.due_date && new Date(t.due_date) < now);
}

export function getUrgentTodos(): TodoItem[] {
  return todos.filter((t) => !t.completed && t.priority === "urgent");
}
