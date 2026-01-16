import React, { useState, useMemo } from "react";
import { cn } from "./lib/utils";
import { useTodoActions } from "../hooks/useTodoActions";
import TodoItemComponent from "./ui/TodoItem";
import TodoInput from "./ui/TodoInput";
import { Badge } from "./ui/badge";
import type { TodoItem, Project, Priority, Progress } from "../types/todo";
import {
  ListTodo,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FolderOpen,
  Plus,
  Filter,
  ChevronDown,
  ChevronRight,
  Inbox,
  Tag as TagIcon,
  Settings,
} from "lucide-react";

type ViewMode = "all" | "today" | "upcoming" | "completed" | "project";
type GroupBy = "none" | "project" | "priority" | "due_date";

interface TodoListProps {
  className?: string;
}

export const TodoList: React.FC<TodoListProps> = ({ className }) => {
  const {
    todos,
    projects,
    tags,
    stats,
    isLoading,
    error,
    createTodo,
    toggleComplete,
    deleteTodo,
  } = useTodoActions();

  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>("project");
  const [showCompleted, setShowCompleted] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["all"]));
  const [showFilters, setShowFilters] = useState(false);

  // Filter todos based on view mode
  const filteredTodos = useMemo(() => {
    let result = [...todos];

    // Filter by completion status
    if (!showCompleted) {
      result = result.filter((t) => !t.completed);
    }

    // Filter by view mode
    switch (viewMode) {
      case "today":
        const today = new Date().toISOString().split("T")[0];
        result = result.filter(
          (t) => t.due_date && t.due_date.startsWith(today)
        );
        break;
      case "upcoming":
        const now = new Date();
        const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        result = result.filter(
          (t) =>
            t.due_date &&
            new Date(t.due_date) > now &&
            new Date(t.due_date) <= weekFromNow
        );
        break;
      case "completed":
        result = todos.filter((t) => t.completed);
        break;
      case "project":
        if (selectedProjectId !== null) {
          result = result.filter((t) => t.project_id === selectedProjectId);
        }
        break;
    }

    return result;
  }, [todos, viewMode, selectedProjectId, showCompleted]);

  // Group todos
  const groupedTodos = useMemo(() => {
    if (groupBy === "none") {
      return [{ key: "all", label: "All Tasks", todos: filteredTodos }];
    }

    const groups = new Map<string, { label: string; todos: TodoItem[]; color?: string }>();

    filteredTodos.forEach((todo) => {
      let key: string;
      let label: string;
      let color: string | undefined;

      switch (groupBy) {
        case "project":
          key = todo.project_id?.toString() || "no-project";
          label = todo.project_name || "No Project";
          color = todo.project_color;
          break;
        case "priority":
          key = todo.priority;
          label = todo.priority.charAt(0).toUpperCase() + todo.priority.slice(1);
          break;
        case "due_date":
          if (!todo.due_date) {
            key = "no-date";
            label = "No Due Date";
          } else {
            const date = new Date(todo.due_date);
            const today = new Date();
            const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

            if (date < today && !todo.completed) {
              key = "overdue";
              label = "Overdue";
            } else if (date.toDateString() === today.toDateString()) {
              key = "today";
              label = "Today";
            } else if (date.toDateString() === tomorrow.toDateString()) {
              key = "tomorrow";
              label = "Tomorrow";
            } else {
              key = "later";
              label = "Later";
            }
          }
          break;
        default:
          key = "all";
          label = "All Tasks";
      }

      if (!groups.has(key)) {
        groups.set(key, { label, todos: [], color });
      }
      groups.get(key)!.todos.push(todo);
    });

    // Sort groups
    const sortedGroups = Array.from(groups.entries()).map(([key, value]) => ({
      key,
      ...value,
    }));

    if (groupBy === "priority") {
      const priorityOrder = ["urgent", "high", "medium", "low"];
      sortedGroups.sort(
        (a, b) => priorityOrder.indexOf(a.key) - priorityOrder.indexOf(b.key)
      );
    }

    return sortedGroups;
  }, [filteredTodos, groupBy]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSelectProject = (projectId: number | null) => {
    setSelectedProjectId(projectId);
    setViewMode("project");
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header with stats */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <ListTodo className="size-5 text-indigo-600" />
            Tasks
          </h2>
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="secondary" className="bg-indigo-50 text-indigo-700">
              {stats.pending} pending
            </Badge>
            {stats.urgent > 0 && (
              <Badge variant="secondary" className="bg-red-50 text-red-600">
                {stats.urgent} urgent
              </Badge>
            )}
            {stats.overdue > 0 && (
              <Badge variant="secondary" className="bg-orange-50 text-orange-600">
                {stats.overdue} overdue
              </Badge>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            "p-2 rounded-lg transition-colors",
            showFilters ? "bg-indigo-50 text-indigo-600" : "hover:bg-gray-100 text-gray-500"
          )}
        >
          <Filter className="size-4" />
        </button>
      </div>

      {/* Filters bar */}
      {showFilters && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-xl">
          <span className="text-xs text-gray-500">View:</span>
          <div className="flex items-center gap-1">
            {[
              { id: "all", label: "All", icon: Inbox },
              { id: "today", label: "Today", icon: Clock },
              { id: "upcoming", label: "Upcoming", icon: ListTodo },
              { id: "completed", label: "Completed", icon: CheckCircle2 },
            ].map((view) => (
              <button
                key={view.id}
                onClick={() => {
                  setViewMode(view.id as ViewMode);
                  if (view.id !== "project") setSelectedProjectId(null);
                }}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors",
                  viewMode === view.id
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-gray-600 hover:bg-white/50"
                )}
              >
                <view.icon className="size-3" />
                {view.label}
              </button>
            ))}
          </div>
          <div className="h-4 w-px bg-gray-300 mx-2" />
          <span className="text-xs text-gray-500">Group by:</span>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            className="text-xs px-2 py-1 rounded-md border border-gray-200 bg-white"
          >
            <option value="none">None</option>
            <option value="project">Project</option>
            <option value="priority">Priority</option>
            <option value="due_date">Due Date</option>
          </select>
          <label className="flex items-center gap-1 ml-auto text-xs text-gray-500">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
              className="rounded"
            />
            Show completed
          </label>
        </div>
      )}

      {/* Project sidebar and main content */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Projects sidebar */}
        <div className="w-48 flex-shrink-0 space-y-1">
          <button
            onClick={() => {
              setViewMode("all");
              setSelectedProjectId(null);
            }}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
              viewMode === "all" && selectedProjectId === null
                ? "bg-indigo-50 text-indigo-700"
                : "text-gray-600 hover:bg-gray-100"
            )}
          >
            <Inbox className="size-4" />
            All Tasks
            <span className="ml-auto text-xs text-gray-400">{stats.total}</span>
          </button>

          <div className="pt-3 pb-1 px-3">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Projects
            </span>
          </div>

          {projects.map((project) => {
            const count = todos.filter((t) => t.project_id === project.id && !t.completed).length;
            return (
              <button
                key={project.id}
                onClick={() => handleSelectProject(project.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                  viewMode === "project" && selectedProjectId === project.id
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-gray-600 hover:bg-gray-100"
                )}
              >
                <span
                  className="size-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: project.color }}
                />
                <span className="truncate">{project.name}</span>
                {count > 0 && (
                  <span className="ml-auto text-xs text-gray-400">{count}</span>
                )}
              </button>
            );
          })}

          <button
            onClick={() => handleSelectProject(null)}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
              viewMode === "project" && selectedProjectId === null
                ? "bg-indigo-50 text-indigo-700"
                : "text-gray-600 hover:bg-gray-100"
            )}
          >
            <FolderOpen className="size-4 text-gray-400" />
            <span className="truncate">No Project</span>
          </button>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Input form */}
          <div className="mb-4 p-4 bg-gray-50 rounded-xl">
            <TodoInput
              projects={projects}
              tags={tags}
              onSubmit={createTodo}
              defaultProjectId={viewMode === "project" ? selectedProjectId ?? undefined : undefined}
            />
          </div>

          {/* Todo list */}
          <div className="flex-1 overflow-y-auto space-y-4">
            {filteredTodos.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <CheckCircle2 className="size-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">
                  {viewMode === "completed"
                    ? "No completed tasks yet"
                    : "No tasks to show. Add one above!"}
                </p>
              </div>
            ) : (
              groupedTodos.map((group) => (
                <div key={group.key} className="space-y-2">
                  {groupBy !== "none" && (
                    <button
                      onClick={() => toggleGroup(group.key)}
                      className="flex items-center gap-2 w-full text-left py-1"
                    >
                      {expandedGroups.has(group.key) ? (
                        <ChevronDown className="size-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="size-4 text-gray-400" />
                      )}
                      {group.color && (
                        <span
                          className="size-3 rounded-full"
                          style={{ backgroundColor: group.color }}
                        />
                      )}
                      <span className="text-sm font-medium text-gray-700">
                        {group.label}
                      </span>
                      <span className="text-xs text-gray-400">
                        ({group.todos.length})
                      </span>
                    </button>
                  )}

                  {(groupBy === "none" || expandedGroups.has(group.key)) && (
                    <div className="space-y-2">
                      {group.todos.map((todo) => (
                        <TodoItemComponent
                          key={todo.id}
                          todo={todo}
                          onToggleComplete={toggleComplete}
                          onDelete={deleteTodo}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
          {error}
        </div>
      )}
    </div>
  );
};

export default TodoList;
