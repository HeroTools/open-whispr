import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Plus,
  Search,
  Pin,
  Trash2,
  Mic,
  MicOff,
  Loader2,
  FileText,
} from "lucide-react";
import { useNotes, initializeNotes, removeNote } from "../stores/notesStore";
import { useToast } from "./ui/Toast";
import { ConfirmDialog } from "./ui/dialog";
import type { NoteItem } from "../types/electron";

interface NotesPageProps {
  onVoiceRecord?: () => void;
  isRecording?: boolean;
  isProcessing?: boolean;
  onNoteSelect?: (noteId: number | null) => void;
}

export default function NotesPage({
  onVoiceRecord,
  isRecording = false,
  isProcessing = false,
  onNoteSelect,
}: NotesPageProps) {
  const notes = useNotes();
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const { toast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState<{
    open: boolean;
    noteId: number | null;
  }>({ open: false, noteId: null });
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load notes on mount and cleanup on unmount
  useEffect(() => {
    loadNotes();
    return () => {
      // Clear any pending save timeout on unmount
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Notify parent when selected note changes
  useEffect(() => {
    onNoteSelect?.(selectedNoteId);
  }, [selectedNoteId, onNoteSelect]);

  // Keyboard shortcut for voice recording (Shift+N)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Shift+N
      if (e.shiftKey && e.key.toLowerCase() === "n" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // Don't trigger if typing in an input field
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
          return;
        }
        e.preventDefault();
        if (selectedNoteId && onVoiceRecord) {
          onVoiceRecord();
        } else if (!selectedNoteId) {
          toast({
            title: "Select a note first",
            description: "Please select or create a note before recording.",
            variant: "default",
          });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNoteId, onVoiceRecord, toast]);

  // Update editor when selected note changes
  useEffect(() => {
    if (selectedNoteId) {
      const note = notes.find((n) => n.id === selectedNoteId);
      if (note) {
        setEditTitle(note.title || "");
        setEditContent(note.content);
      }
    } else {
      setEditTitle("");
      setEditContent("");
    }
  }, [selectedNoteId, notes]);

  const loadNotes = async () => {
    try {
      setIsLoading(true);
      await initializeNotes();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load notes",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createNewNote = async () => {
    try {
      const result = await window.electronAPI.createNote(null, "");
      if (result.success && result.note) {
        setSelectedNoteId(result.note.id);
        setEditTitle("");
        setEditContent("");
        // Focus on content area
        setTimeout(() => contentRef.current?.focus(), 100);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create note",
        variant: "destructive",
      });
    }
  };

  // Auto-save with debounce
  const saveNote = useCallback(
    async (title: string, content: string) => {
      if (!selectedNoteId) return;

      setIsSaving(true);
      try {
        await window.electronAPI.updateNote(selectedNoteId, title || null, content);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to save note",
          variant: "destructive",
        });
      } finally {
        setIsSaving(false);
      }
    },
    [selectedNoteId, toast]
  );

  // Debounced save
  const debouncedSave = useCallback(
    (title: string, content: string) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        saveNote(title, content);
      }, 500);
    },
    [saveNote]
  );

  const handleTitleChange = (value: string) => {
    setEditTitle(value);
    debouncedSave(value, editContent);
  };

  const handleContentChange = (value: string) => {
    setEditContent(value);
    debouncedSave(editTitle, value);
  };

  const handleDeleteNote = async (noteId: number) => {
    try {
      const result = await window.electronAPI.deleteNote(noteId);
      if (result.success) {
        removeNote(noteId);
        if (selectedNoteId === noteId) {
          setSelectedNoteId(null);
        }
        toast({
          title: "Note deleted",
          description: "Note has been removed",
          variant: "success",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete note",
        variant: "destructive",
      });
    }
  };

  const handleTogglePin = async (noteId: number) => {
    try {
      await window.electronAPI.toggleNotePin(noteId);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to pin note",
        variant: "destructive",
      });
    }
  };

  // Filter notes based on search
  const filteredNotes = searchQuery
    ? notes.filter(
        (note) =>
          note.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          note.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : notes;

  const selectedNote = notes.find((n) => n.id === selectedNoteId);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: "long" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  const getPreviewText = (note: NoteItem) => {
    const text = note.content.trim();
    if (!text) return "No content";
    const firstLine = text.split("\n")[0];
    return firstLine.length > 60 ? firstLine.slice(0, 60) + "..." : firstLine;
  };

  return (
    <div className="flex h-[calc(100vh-60px)] bg-white">
      <ConfirmDialog
        open={confirmDelete.open}
        onOpenChange={(open) => setConfirmDelete({ open, noteId: null })}
        title="Delete Note"
        description="Are you sure you want to delete this note? This action cannot be undone."
        onConfirm={() => {
          if (confirmDelete.noteId) {
            handleDeleteNote(confirmDelete.noteId);
          }
        }}
        variant="destructive"
      />

      {/* Notes Sidebar */}
      <div className="w-72 border-r border-neutral-200 flex flex-col bg-neutral-50/50">
        {/* Search and New Note */}
        <div className="p-3 border-b border-neutral-200 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <Input
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 bg-white border-neutral-200 focus:border-indigo-300 focus:ring-indigo-200"
            />
          </div>
          <Button
            onClick={createNewNote}
            className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
            size="sm"
          >
            <Plus className="h-4 w-4" />
            New Note
          </Button>
        </div>

        {/* Notes List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="text-center py-12 px-4">
              <FileText className="h-12 w-12 mx-auto text-neutral-300 mb-3" />
              <p className="text-neutral-500 text-sm">
                {searchQuery ? "No notes found" : "No notes yet"}
              </p>
              {!searchQuery && (
                <p className="text-neutral-400 text-xs mt-1">
                  Create your first note to get started
                </p>
              )}
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {filteredNotes.map((note) => (
                <button
                  key={note.id}
                  onClick={() => setSelectedNoteId(note.id)}
                  className={`w-full text-left p-3 hover:bg-neutral-100 transition-colors ${
                    selectedNoteId === note.id
                      ? "bg-indigo-50 border-l-2 border-indigo-600"
                      : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {note.is_pinned === 1 && (
                          <Pin className="h-3 w-3 text-indigo-600 flex-shrink-0" />
                        )}
                        <h3 className="font-medium text-neutral-900 truncate text-sm">
                          {note.title || "Untitled"}
                        </h3>
                      </div>
                      <p className="text-xs text-neutral-500 truncate mt-0.5">
                        {getPreviewText(note)}
                      </p>
                      <p className="text-xs text-neutral-400 mt-1">
                        {formatDate(note.updated_at)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Note Editor */}
      <div className="flex-1 flex flex-col">
        {selectedNote ? (
          <>
            {/* Editor Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-200">
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                {isSaving && (
                  <span className="flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Saving...
                  </span>
                )}
                {!isSaving && (
                  <span>Edited {formatDate(selectedNote.updated_at)}</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {/* Voice Recording Button */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onVoiceRecord}
                    disabled={isProcessing}
                    className={`${
                      isRecording
                        ? "bg-red-100 text-red-600 hover:bg-red-200"
                        : "text-neutral-600 hover:text-indigo-600"
                    }`}
                    title={isRecording ? "Stop recording (Shift+N)" : "Record voice note (Shift+N)"}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isRecording ? (
                      <MicOff className="h-4 w-4" />
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                  </Button>
                  <span className="text-[10px] text-neutral-400 hidden sm:inline">
                    Shift+N
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleTogglePin(selectedNote.id)}
                  className={
                    selectedNote.is_pinned
                      ? "text-indigo-600"
                      : "text-neutral-600 hover:text-indigo-600"
                  }
                  title={selectedNote.is_pinned ? "Unpin note" : "Pin note"}
                >
                  <Pin className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setConfirmDelete({ open: true, noteId: selectedNote.id })
                  }
                  className="text-neutral-600 hover:text-red-600"
                  title="Delete note"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Editor Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Title"
                className="w-full text-2xl font-semibold text-neutral-900 placeholder:text-neutral-400 bg-transparent border-none outline-none mb-4"
              />
              <textarea
                ref={contentRef}
                value={editContent}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="Start writing..."
                className="w-full h-[calc(100%-4rem)] text-neutral-700 placeholder:text-neutral-400 bg-transparent border-none outline-none resize-none leading-relaxed"
              />
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-neutral-100 rounded-full flex items-center justify-center">
                <FileText className="h-8 w-8 text-neutral-400" />
              </div>
              <h3 className="text-lg font-medium text-neutral-900 mb-2">
                Select a note
              </h3>
              <p className="text-neutral-500 text-sm mb-4">
                Choose a note from the sidebar or create a new one
              </p>
              <Button
                onClick={createNewNote}
                className="gap-2 bg-indigo-600 hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                New Note
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
