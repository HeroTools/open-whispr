import React from "react";
import { cn } from "../lib/utils";
import { Badge } from "./badge";
import type { TodoItem as TodoItemType, Priority, Progress } from "../../types/todo";
import {
  Check,
  Circle,
  Clock,
  AlertTriangle,
  Trash2,
  Calendar,
  FolderOpen,
  MoreHorizontal,
} from "lucide-react";

interface TodoItemProps {
  todo: TodoItemType;
  onToggleComplete: (id: number) => void;
  onDelete: (id: number) => void;
  onEdit?: (todo: TodoItemType) => void;
  compact?: boolean;
}

const priorityColors: Record<Priority, string> = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-blue-100 text-blue-600",
  high: "bg-orange-100 text-orange-600",
  urgent: "bg-red-100 text-red-600",
};

const priorityIcons: Record<Priority, React.ReactNode> = {
  low: null,
  medium: null,
  high: <AlertTriangle className="size-3" />,
  urgent: <AlertTriangle className="size-3 animate-pulse" />,
};

const progressColors: Record<Progress, string> = {
  not_started: "bg-gray-100 text-gray-600",
  in_progress: "bg-yellow-100 text-yellow-700",
  blocked: "bg-red-100 text-red-600",
  completed: "bg-green-100 text-green-600",
};

const progressLabels: Record<Progress, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  blocked: "Blocked",
  completed: "Completed",
};

function formatDueDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"} overdue`;
  } else if (diffDays === 0) {
    return "Due today";
  } else if (diffDays === 1) {
    return "Due tomorrow";
  } else if (diffDays <= 7) {
    return `Due in ${diffDays} days`;
  } else {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
}

function isOverdue(dateStr: string | null, completed: boolean): boolean {
  if (!dateStr || completed) return false;
  return new Date(dateStr) < new Date();
}

export const TodoItemComponent: React.FC<TodoItemProps> = ({
  todo,
  onToggleComplete,
  onDelete,
  onEdit,
  compact = false,
}) => {
  const dueDateStr = formatDueDate(todo.due_date);
  const overdue = isOverdue(todo.due_date, todo.completed);

  return (
    <div
      className={cn(
        "group flex items-start gap-3 p-3 rounded-xl border transition-all duration-200",
        "hover:shadow-sm hover:border-gray-300",
        todo.completed
          ? "bg-gray-50/50 border-gray-100"
          : "bg-white border-gray-200",
        compact && "p-2"
      )}
    >
      {/* Checkbox */}
      <button
        onClick={() => onToggleComplete(todo.id)}
        className={cn(
          "flex-shrink-0 mt-0.5 size-5 rounded-full border-2 flex items-center justify-center transition-all duration-200",
          todo.completed
            ? "bg-green-500 border-green-500 text-white"
            : "border-gray-300 hover:border-green-400 hover:bg-green-50"
        )}
      >
        {todo.completed && <Check className="size-3" strokeWidth={3} />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* Title */}
            <h4
              className={cn(
                "text-sm font-medium leading-tight truncate",
                todo.completed ? "text-gray-400 line-through" : "text-gray-900"
              )}
            >
              {todo.title}
            </h4>

            {/* Description (only show if not compact and has description) */}
            {!compact && todo.description && (
              <p
                className={cn(
                  "text-xs mt-1 line-clamp-2",
                  todo.completed ? "text-gray-300" : "text-gray-500"
                )}
              >
                {todo.description}
              </p>
            )}

            {/* Meta information */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {/* Project badge */}
              {todo.project_name && (
                <span
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: `${todo.project_color}20`,
                    color: todo.project_color,
                  }}
                >
                  <FolderOpen className="size-3" />
                  {todo.project_name}
                </span>
              )}

              {/* Priority badge */}
              {todo.priority !== "medium" && (
                <Badge
                  className={cn(
                    "text-xs px-2 py-0.5 font-normal capitalize",
                    priorityColors[todo.priority]
                  )}
                  variant="secondary"
                >
                  {priorityIcons[todo.priority]}
                  {todo.priority}
                </Badge>
              )}

              {/* Progress badge (if not completed and not 'not_started') */}
              {!todo.completed && todo.progress !== "not_started" && (
                <Badge
                  className={cn(
                    "text-xs px-2 py-0.5 font-normal",
                    progressColors[todo.progress]
                  )}
                  variant="secondary"
                >
                  {progressLabels[todo.progress]}
                </Badge>
              )}

              {/* Due date */}
              {dueDateStr && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-xs",
                    overdue ? "text-red-500 font-medium" : "text-gray-400"
                  )}
                >
                  <Clock className="size-3" />
                  {dueDateStr}
                </span>
              )}

              {/* Tags */}
              {todo.tags && todo.tags.length > 0 && (
                <div className="flex items-center gap-1">
                  {todo.tags.slice(0, 2).map((tag) => (
                    <span
                      key={tag.id}
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: `${tag.color}20`,
                        color: tag.color,
                      }}
                    >
                      {tag.name}
                    </span>
                  ))}
                  {todo.tags.length > 2 && (
                    <span className="text-xs text-gray-400">
                      +{todo.tags.length - 2}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onEdit && (
              <button
                onClick={() => onEdit(todo)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <MoreHorizontal className="size-4" />
              </button>
            )}
            <button
              onClick={() => onDelete(todo.id)}
              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TodoItemComponent;
