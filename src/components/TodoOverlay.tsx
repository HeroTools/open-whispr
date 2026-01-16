import React, { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "./lib/utils";
import { useTodoActions } from "../hooks/useTodoActions";
import type { TodoItem, Project } from "../types/todo";
import {
  Check,
  X,
  ChevronRight,
  Plus,
  ListTodo,
  Clock,
  AlertTriangle,
} from "lucide-react";

interface TodoOverlayProps {
  isVisible: boolean;
  onClose: () => void;
  onStartRecording?: () => void;
}

const priorityDots: Record<string, string> = {
  low: "bg-slate-400",
  medium: "bg-blue-400",
  high: "bg-orange-400",
  urgent: "bg-red-500 animate-pulse",
};

export const TodoOverlay: React.FC<TodoOverlayProps> = ({
  isVisible,
  onClose,
  onStartRecording,
}) => {
  const {
    todos,
    projects,
    stats,
    isLoading,
    createTodo,
    toggleComplete,
  } = useTodoActions();

  const [quickAddText, setQuickAddText] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<number | null>>(
    new Set([null])
  );

  // Group todos by project, only pending ones
  const groupedTodos = useMemo(() => {
    const pending = todos.filter((t) => !t.completed);
    const groups = new Map<number | null, { project: Project | null; todos: TodoItem[] }>();

    // Initialize with "No Project" group
    groups.set(null, { project: null, todos: [] });

    // Initialize project groups
    projects.forEach((p) => {
      groups.set(p.id, { project: p, todos: [] });
    });

    // Assign todos to groups
    pending.forEach((todo) => {
      const key = todo.project_id;
      if (groups.has(key)) {
        groups.get(key)!.todos.push(todo);
      } else {
        groups.get(null)!.todos.push(todo);
      }
    });

    // Filter out empty groups and convert to array
    return Array.from(groups.entries())
      .filter(([_, value]) => value.todos.length > 0)
      .map(([key, value]) => ({ id: key, ...value }));
  }, [todos, projects]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "Enter" && quickAddText.trim()) {
        handleQuickAdd();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isVisible, quickAddText, onClose]);

  const handleQuickAdd = async () => {
    if (!quickAddText.trim()) return;

    try {
      await createTodo({
        title: quickAddText.trim(),
        project_id: selectedProjectId ?? undefined,
      });
      setQuickAddText("");
    } catch (err) {
      console.error("Failed to create todo:", err);
    }
  };

  const toggleProject = (projectId: number | null) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const handleToggleComplete = async (id: number) => {
    try {
      await toggleComplete(id);
    } catch (err) {
      console.error("Failed to toggle todo:", err);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
      {/* Backdrop - subtle blur */}
      <div
        className="absolute inset-0 bg-black/10 backdrop-blur-[2px] pointer-events-auto"
        onClick={onClose}
      />

      {/* Overlay panel */}
      <div
        className={cn(
          "relative w-full max-w-md mb-24 mx-4 pointer-events-auto",
          "animate-in slide-in-from-bottom-4 fade-in duration-200"
        )}
      >
        <div
          className={cn(
            "bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl",
            "border border-white/20 overflow-hidden"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <ListTodo className="size-5 text-indigo-600" />
              <h3 className="font-semibold text-gray-900">Tasks</h3>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {stats.pending} pending
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Quick add input */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={quickAddText}
                  onChange={(e) => setQuickAddText(e.target.value)}
                  placeholder="Quick add task..."
                  autoFocus
                  className={cn(
                    "w-full h-10 pl-4 pr-10 bg-gray-50 rounded-xl text-sm",
                    "border border-gray-200 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100",
                    "outline-none transition-all placeholder:text-gray-400"
                  )}
                />
                <button
                  onClick={handleQuickAdd}
                  disabled={!quickAddText.trim()}
                  className={cn(
                    "absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors",
                    quickAddText.trim()
                      ? "text-indigo-600 hover:bg-indigo-50"
                      : "text-gray-300"
                  )}
                >
                  <Plus className="size-4" />
                </button>
              </div>
              {onStartRecording && (
                <button
                  onClick={onStartRecording}
                  className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
                  title="Voice record task"
                >
                  <svg
                    className="size-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Task list */}
          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
              </div>
            ) : groupedTodos.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Check className="size-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">All caught up!</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {groupedTodos.map((group) => (
                  <div key={group.id ?? "no-project"}>
                    {/* Project header */}
                    <button
                      onClick={() => toggleProject(group.id)}
                      className={cn(
                        "w-full flex items-center gap-2 px-4 py-2 text-left",
                        "hover:bg-gray-50 transition-colors"
                      )}
                    >
                      <ChevronRight
                        className={cn(
                          "size-4 text-gray-400 transition-transform",
                          expandedProjects.has(group.id) && "rotate-90"
                        )}
                      />
                      {group.project ? (
                        <>
                          <span
                            className="size-2.5 rounded-full"
                            style={{ backgroundColor: group.project.color }}
                          />
                          <span className="text-sm font-medium text-gray-700">
                            {group.project.name}
                          </span>
                        </>
                      ) : (
                        <span className="text-sm font-medium text-gray-500">
                          No Project
                        </span>
                      )}
                      <span className="text-xs text-gray-400 ml-auto">
                        {group.todos.length}
                      </span>
                    </button>

                    {/* Tasks in project */}
                    {expandedProjects.has(group.id) && (
                      <div className="pb-1">
                        {group.todos.slice(0, 5).map((todo) => (
                          <div
                            key={todo.id}
                            className={cn(
                              "group flex items-center gap-3 px-4 py-2 pl-10",
                              "hover:bg-gray-50 transition-colors"
                            )}
                          >
                            {/* Checkbox */}
                            <button
                              onClick={() => handleToggleComplete(todo.id)}
                              className={cn(
                                "flex-shrink-0 size-5 rounded-full border-2 flex items-center justify-center",
                                "border-gray-300 hover:border-green-400 hover:bg-green-50 transition-all"
                              )}
                            >
                              <Check className="size-3 text-transparent group-hover:text-green-400" />
                            </button>

                            {/* Title & meta */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-900 truncate">
                                {todo.title}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {/* Priority indicator */}
                                {todo.priority !== "medium" && (
                                  <span
                                    className={cn(
                                      "size-1.5 rounded-full",
                                      priorityDots[todo.priority]
                                    )}
                                  />
                                )}
                                {/* Due date */}
                                {todo.due_date && (
                                  <span className="flex items-center gap-1 text-xs text-gray-400">
                                    <Clock className="size-3" />
                                    {new Date(todo.due_date).toLocaleDateString(
                                      "en-US",
                                      { month: "short", day: "numeric" }
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        {group.todos.length > 5 && (
                          <p className="text-xs text-gray-400 text-center py-2">
                            +{group.todos.length - 5} more
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer with stats */}
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>
              {stats.completed} completed today
            </span>
            {stats.overdue > 0 && (
              <span className="flex items-center gap-1 text-orange-500">
                <AlertTriangle className="size-3" />
                {stats.overdue} overdue
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TodoOverlay;
