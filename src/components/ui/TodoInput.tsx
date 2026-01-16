import React, { useState, useRef, useEffect } from "react";
import { cn } from "../lib/utils";
import { Input } from "./input";
import { Button } from "./button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import type { Project, Tag, Priority, CreateTodoData } from "../../types/todo";
import {
  Plus,
  Calendar,
  Flag,
  FolderOpen,
  Tag as TagIcon,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";

interface TodoInputProps {
  projects: Project[];
  tags: Tag[];
  onSubmit: (data: CreateTodoData) => Promise<void>;
  defaultProjectId?: number;
  compact?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

const priorityOptions: { value: Priority; label: string; color: string }[] = [
  { value: "low", label: "Low", color: "text-slate-500" },
  { value: "medium", label: "Medium", color: "text-blue-500" },
  { value: "high", label: "High", color: "text-orange-500" },
  { value: "urgent", label: "Urgent", color: "text-red-500" },
];

export const TodoInput: React.FC<TodoInputProps> = ({
  projects,
  tags,
  onSubmit,
  defaultProjectId,
  compact = false,
  placeholder = "Add a new task...",
  autoFocus = false,
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [projectId, setProjectId] = useState<number | undefined>(defaultProjectId);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        due_date: dueDate || undefined,
        priority,
        project_id: projectId,
        tag_ids: selectedTags.length > 0 ? selectedTags : undefined,
      });

      // Reset form
      setTitle("");
      setDescription("");
      setDueDate("");
      setPriority("medium");
      setSelectedTags([]);
      setShowAdvanced(false);
      inputRef.current?.focus();
    } catch (error) {
      console.error("Failed to create todo:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !showAdvanced) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const toggleTag = (tagId: number) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="pr-10 h-10 bg-gray-50 border-gray-200 focus:bg-white"
          />
          <button
            type="submit"
            disabled={!title.trim() || isSubmitting}
            className={cn(
              "absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors",
              title.trim()
                ? "text-indigo-600 hover:bg-indigo-50"
                : "text-gray-300"
            )}
          >
            <Plus className="size-5" />
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Main input row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="h-11 bg-white border-gray-200 text-base"
          />
        </div>
        <Button
          type="submit"
          disabled={!title.trim() || isSubmitting}
          className="h-11 px-4"
        >
          <Plus className="size-4 mr-1" />
          Add
        </Button>
      </div>

      {/* Quick options row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Project selector */}
        <Select
          value={projectId?.toString() || ""}
          onValueChange={(v) => setProjectId(v ? parseInt(v) : undefined)}
        >
          <SelectTrigger className="w-auto h-8 text-xs gap-1 border-dashed">
            <FolderOpen className="size-3 text-gray-400" />
            <SelectValue placeholder="Project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">No Project</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id.toString()}>
                <span className="flex items-center gap-2">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: project.color }}
                  />
                  {project.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Priority selector */}
        <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
          <SelectTrigger className="w-auto h-8 text-xs gap-1 border-dashed">
            <Flag className="size-3 text-gray-400" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {priorityOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <span className={cn("capitalize", opt.color)}>{opt.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Due date */}
        <div className="relative">
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={cn(
              "h-8 px-2 text-xs border border-dashed border-gray-300 rounded-md",
              "focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500",
              !dueDate && "text-gray-400"
            )}
          />
          {dueDate && (
            <button
              type="button"
              onClick={() => setDueDate("")}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-100"
            >
              <X className="size-3 text-gray-400" />
            </button>
          )}
        </div>

        {/* Toggle advanced options */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={cn(
            "flex items-center gap-1 h-8 px-2 text-xs text-gray-500 hover:text-gray-700",
            "border border-dashed border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          )}
        >
          {showAdvanced ? (
            <>
              <ChevronUp className="size-3" />
              Less
            </>
          ) : (
            <>
              <ChevronDown className="size-3" />
              More
            </>
          )}
        </button>
      </div>

      {/* Advanced options */}
      {showAdvanced && (
        <div className="space-y-3 pt-2 border-t border-gray-100">
          {/* Description */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add more details..."
              rows={2}
              className={cn(
                "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none",
                "focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              )}
            />
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div>
              <label className="text-xs text-gray-500 mb-2 block flex items-center gap-1">
                <TagIcon className="size-3" />
                Tags
              </label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={cn(
                      "px-2 py-1 text-xs rounded-md border transition-all",
                      selectedTags.includes(tag.id)
                        ? "border-transparent"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                    style={
                      selectedTags.includes(tag.id)
                        ? { backgroundColor: tag.color, color: "white" }
                        : { backgroundColor: `${tag.color}10`, color: tag.color }
                    }
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </form>
  );
};

export default TodoInput;
