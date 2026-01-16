import { useCallback, useEffect, useState } from "react";
import type {
  TodoItem,
  Project,
  Tag,
  CreateTodoData,
  UpdateTodoData,
  TodoFilters,
  CreateProjectData,
  UpdateProjectData,
  CreateTagData,
  UpdateTagData,
} from "../types/todo";
import {
  useTodos,
  useProjects,
  useTags,
  useTodoStats,
  initializeTodos,
  initializeProjects,
  initializeTags,
  refreshStats,
  getTodosByProject,
  getPendingTodos,
  getCompletedTodos,
  getOverdueTodos,
  getUrgentTodos,
} from "../stores/todoStore";

export function useTodoActions() {
  const todos = useTodos();
  const projects = useProjects();
  const tags = useTags();
  const stats = useTodoStats();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize data on mount
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      setError(null);
      try {
        await Promise.all([
          initializeTodos(),
          initializeProjects(),
          initializeTags(),
          refreshStats(),
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  // ==================== TODO ACTIONS ====================
  const createTodo = useCallback(async (data: CreateTodoData) => {
    try {
      const result = await window.electronAPI.createTodo(data);
      if (!result.success) {
        throw new Error(result.error || "Failed to create todo");
      }
      return result.todo;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create todo");
      throw err;
    }
  }, []);

  const updateTodo = useCallback(async (id: number, data: UpdateTodoData) => {
    try {
      const result = await window.electronAPI.updateTodo(id, data);
      if (!result.success) {
        throw new Error(result.error || "Failed to update todo");
      }
      return result.todo;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update todo");
      throw err;
    }
  }, []);

  const deleteTodo = useCallback(async (id: number) => {
    try {
      const result = await window.electronAPI.deleteTodo(id);
      if (!result.success) {
        throw new Error(result.error || "Failed to delete todo");
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete todo");
      throw err;
    }
  }, []);

  const toggleComplete = useCallback(async (id: number) => {
    try {
      const result = await window.electronAPI.toggleTodoComplete(id);
      if (!result.success) {
        throw new Error(result.error || "Failed to toggle todo");
      }
      return result.todo;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle todo");
      throw err;
    }
  }, []);

  const filterTodos = useCallback(async (filters: TodoFilters) => {
    try {
      await initializeTodos(filters);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to filter todos");
      throw err;
    }
  }, []);

  // ==================== PROJECT ACTIONS ====================
  const createProject = useCallback(async (data: CreateProjectData) => {
    try {
      const result = await window.electronAPI.createProject(data);
      if (!result.success) {
        throw new Error(result.error || "Failed to create project");
      }
      return result.project;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
      throw err;
    }
  }, []);

  const updateProject = useCallback(async (id: number, data: UpdateProjectData) => {
    try {
      const result = await window.electronAPI.updateProject(id, data);
      if (!result.success) {
        throw new Error(result.error || "Failed to update project");
      }
      return result.project;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update project");
      throw err;
    }
  }, []);

  const deleteProject = useCallback(async (id: number) => {
    try {
      const result = await window.electronAPI.deleteProject(id);
      if (!result.success) {
        throw new Error(result.error || "Failed to delete project");
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete project");
      throw err;
    }
  }, []);

  // ==================== TAG ACTIONS ====================
  const createTag = useCallback(async (data: CreateTagData) => {
    try {
      const result = await window.electronAPI.createTag(data);
      if (!result.success) {
        throw new Error(result.error || "Failed to create tag");
      }
      return result.tag;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create tag");
      throw err;
    }
  }, []);

  const updateTag = useCallback(async (id: number, data: UpdateTagData) => {
    try {
      const result = await window.electronAPI.updateTag(id, data);
      if (!result.success) {
        throw new Error(result.error || "Failed to update tag");
      }
      return result.tag;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update tag");
      throw err;
    }
  }, []);

  const deleteTag = useCallback(async (id: number) => {
    try {
      const result = await window.electronAPI.deleteTag(id);
      if (!result.success) {
        throw new Error(result.error || "Failed to delete tag");
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete tag");
      throw err;
    }
  }, []);

  // ==================== HELPER FUNCTIONS ====================
  const todosByProject = useCallback(
    (projectId: number | null) => getTodosByProject(projectId),
    [todos]
  );

  const pendingTodos = useCallback(() => getPendingTodos(), [todos]);
  const completedTodos = useCallback(() => getCompletedTodos(), [todos]);
  const overdueTodos = useCallback(() => getOverdueTodos(), [todos]);
  const urgentTodos = useCallback(() => getUrgentTodos(), [todos]);

  const clearError = useCallback(() => setError(null), []);

  return {
    // State
    todos,
    projects,
    tags,
    stats,
    isLoading,
    error,

    // Todo actions
    createTodo,
    updateTodo,
    deleteTodo,
    toggleComplete,
    filterTodos,

    // Project actions
    createProject,
    updateProject,
    deleteProject,

    // Tag actions
    createTag,
    updateTag,
    deleteTag,

    // Helpers
    todosByProject,
    pendingTodos,
    completedTodos,
    overdueTodos,
    urgentTodos,
    clearError,
    refreshStats,
  };
}
