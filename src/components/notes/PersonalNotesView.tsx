import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Plus, NotebookPen, Loader2, FolderOpen, Pencil, Trash2, Users } from "lucide-react";
import { Button } from "../ui/button";
import { useToast } from "../ui/Toast";
import NoteListItem from "./NoteListItem";
import NoteEditor from "./NoteEditor";
import NoteEnhanceModal from "./NoteEnhanceModal";
import { useNoteRecording } from "../../hooks/useNoteRecording";
import { cn } from "../lib/utils";
import type { FolderItem } from "../../types/electron";
import {
  useNotes,
  useActiveNoteId,
  useActiveFolderId,
  initializeNotes,
  setActiveNoteId,
  setActiveFolderId,
} from "../../stores/noteStore";

const MEETINGS_FOLDER_NAME = "Meetings";

export default function PersonalNotesView() {
  const notes = useNotes();
  const activeNoteId = useActiveNoteId();
  const activeFolderId = useActiveFolderId();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [localTitle, setLocalTitle] = useState("");
  const [localContent, setLocalContent] = useState("");
  const [finalTranscript, setFinalTranscript] = useState<string | null>(null);
  const [showEnhanceModal, setShowEnhanceModal] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activeNoteRef = useRef<number | null>(null);
  const localContentRef = useRef(localContent);
  localContentRef.current = localContent;
  const localTitleRef = useRef(localTitle);
  localTitleRef.current = localTitle;
  const { toast } = useToast();

  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [folderCounts, setFolderCounts] = useState<Record<number, number>>({});
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingFolderId, setRenamingFolderId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const newFolderInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const activeNote = notes.find((n) => n.id === activeNoteId) ?? null;
  const isMeetingsFolder = useMemo(
    () => folders.find((f) => f.id === activeFolderId)?.name === MEETINGS_FOLDER_NAME,
    [folders, activeFolderId]
  );

  const { isRecording, partialTranscript, startRecording, stopRecording } = useNoteRecording({
    onTranscriptionComplete: useCallback((text: string) => {
      setFinalTranscript(text);
    }, []),
    onPartialTranscript: useCallback(() => {}, []),
    onError: useCallback(
      (error: { title: string; description: string }) => {
        toast({ title: error.title, description: error.description, variant: "destructive" });
      },
      [toast]
    ),
  });

  const loadFolders = useCallback(async () => {
    const [items, counts] = await Promise.all([
      window.electronAPI.getFolders(),
      window.electronAPI.getFolderNoteCounts(),
    ]);
    setFolders(items);
    const countMap: Record<number, number> = {};
    counts.forEach((c) => {
      countMap[c.folder_id] = c.count;
    });
    setFolderCounts(countMap);
    return items;
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const items = await loadFolders();
        const personalFolder = items.find((f) => f.name === "Personal" && f.is_default);
        const initialFolderId = personalFolder?.id ?? items[0]?.id ?? null;
        setActiveFolderId(initialFolderId);
        if (initialFolderId) {
          await initializeNotes(null, 50, initialFolderId);
        }
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [loadFolders]);

  useEffect(() => {
    if (!activeFolderId || isLoading) return;
    const loadForFolder = async () => {
      await initializeNotes(null, 50, activeFolderId);
      setActiveNoteId(null);
    };
    loadForFolder();
  }, [activeFolderId, isLoading]);

  useEffect(() => {
    if (activeNote && activeNote.id !== activeNoteRef.current) {
      activeNoteRef.current = activeNote.id;
      setLocalTitle(activeNote.title);
      setLocalContent(activeNote.content);
    }
    if (!activeNote) {
      activeNoteRef.current = null;
    }
  }, [activeNote]);

  const debouncedSave = useCallback((noteId: number, title: string, content: string) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        await window.electronAPI.updateNote(noteId, { title, content });
      } finally {
        setIsSaving(false);
      }
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const handleTitleChange = useCallback(
    (title: string) => {
      setLocalTitle(title);
      if (activeNoteId) debouncedSave(activeNoteId, title, localContent);
    },
    [activeNoteId, localContent, debouncedSave]
  );

  const handleContentChange = useCallback(
    (content: string) => {
      setLocalContent(content);
      if (activeNoteId) debouncedSave(activeNoteId, localTitle, content);
    },
    [activeNoteId, localTitle, debouncedSave]
  );

  const handleNewNote = useCallback(async () => {
    if (!activeFolderId || isMeetingsFolder) return;
    const result = await window.electronAPI.saveNote(
      "Untitled Note", "", "personal", null, null, activeFolderId
    );
    if (result.success && result.note) {
      setActiveNoteId(result.note.id);
      loadFolders();
    }
  }, [activeFolderId, isMeetingsFolder, loadFolders]);

  const handleDelete = useCallback(
    async (id: number) => {
      await window.electronAPI.deleteNote(id);
      if (activeNoteId === id) {
        const remaining = notes.filter((n) => n.id !== id);
        setActiveNoteId(remaining.length > 0 ? remaining[0].id : null);
      }
      loadFolders();
    },
    [activeNoteId, notes, loadFolders]
  );

  const handleApplyEnhancement = useCallback(
    async (enhancedContent: string, prompt: string) => {
      if (!activeNoteId) return;
      const hash =
        String(localContentRef.current.length) + "-" + localContentRef.current.slice(0, 50);
      setIsSaving(true);
      try {
        await window.electronAPI.updateNote(activeNoteId, {
          enhanced_content: enhancedContent,
          enhancement_prompt: prompt,
          enhanced_at_content_hash: hash,
        });
      } finally {
        setIsSaving(false);
      }
      setShowEnhanceModal(false);
    },
    [activeNoteId]
  );

  const isEnhancementStale = useMemo(() => {
    if (!activeNote?.enhanced_content || !activeNote?.enhanced_at_content_hash) return false;
    const currentHash = String(localContent.length) + "-" + localContent.slice(0, 50);
    return currentHash !== activeNote.enhanced_at_content_hash;
  }, [activeNote?.enhanced_content, activeNote?.enhanced_at_content_hash, localContent]);

  const handleExportNote = useCallback(
    async (format: "md" | "txt") => {
      if (!activeNoteId) return;
      await window.electronAPI.exportNote(activeNoteId, format);
    },
    [activeNoteId]
  );

  const handleCreateFolder = useCallback(async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      setIsCreatingFolder(false);
      setNewFolderName("");
      return;
    }
    const result = await window.electronAPI.createFolder(trimmed);
    if (result.success && result.folder) {
      await loadFolders();
      setActiveFolderId(result.folder.id);
    } else if (result.error) {
      toast({ title: "Couldn't create folder", description: result.error, variant: "destructive" });
    }
    setIsCreatingFolder(false);
    setNewFolderName("");
  }, [newFolderName, loadFolders, toast]);

  const handleRenameFolder = useCallback(async () => {
    if (!renamingFolderId) return;
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenamingFolderId(null);
      setRenameValue("");
      return;
    }
    const result = await window.electronAPI.renameFolder(renamingFolderId, trimmed);
    if (result.success) {
      await loadFolders();
    } else if (result.error) {
      toast({ title: "Couldn't rename folder", description: result.error, variant: "destructive" });
    }
    setRenamingFolderId(null);
    setRenameValue("");
  }, [renamingFolderId, renameValue, loadFolders, toast]);

  const handleDeleteFolder = useCallback(
    async (folderId: number) => {
      const result = await window.electronAPI.deleteFolder(folderId);
      if (result.success) {
        const personalFolder = folders.find((f) => f.name === "Personal" && f.is_default);
        if (activeFolderId === folderId && personalFolder) {
          setActiveFolderId(personalFolder.id);
        }
        await loadFolders();
      } else if (result.error) {
        toast({ title: "Couldn't delete folder", description: result.error, variant: "destructive" });
      }
    },
    [folders, activeFolderId, loadFolders, toast]
  );

  useEffect(() => {
    if (isCreatingFolder && newFolderInputRef.current) {
      newFolderInputRef.current.focus();
    }
  }, [isCreatingFolder]);

  useEffect(() => {
    if (renamingFolderId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingFolderId]);

  const editorNote = activeNote
    ? { ...activeNote, title: localTitle, content: localContent }
    : null;

  return (
    <div className="flex h-full">
      <div className="w-52 shrink-0 border-r border-border/15 dark:border-white/4 flex flex-col">
        {/* Folders */}
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/25">
            Folders
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCreatingFolder(true)}
            className="h-5 w-5 rounded-md text-muted-foreground/30 hover:text-foreground/60 hover:bg-foreground/5"
          >
            <Plus size={13} />
          </Button>
        </div>

        <div className="px-1.5 space-y-px">
          {folders.map((folder) => {
            const isActive = folder.id === activeFolderId;
            const isMeetings = folder.name === MEETINGS_FOLDER_NAME;
            const count = folderCounts[folder.id] || 0;
            const isRenaming = renamingFolderId === folder.id;

            if (isRenaming) {
              return (
                <div key={folder.id} className="px-2">
                  <input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRenameFolder();
                      if (e.key === "Escape") {
                        setRenamingFolderId(null);
                        setRenameValue("");
                      }
                    }}
                    onBlur={handleRenameFolder}
                    className="w-full h-6 bg-foreground/5 dark:bg-white/5 rounded px-2 text-[11px] text-foreground outline-none border border-primary/30 focus:border-primary/50"
                  />
                </div>
              );
            }

            return (
              <div
                key={folder.id}
                role="button"
                tabIndex={0}
                onClick={() => setActiveFolderId(folder.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setActiveFolderId(folder.id);
                }}
                className={cn(
                  "group relative flex items-center gap-2 w-full h-7 px-2 rounded-md cursor-pointer transition-all duration-150",
                  isActive
                    ? "bg-primary/8 dark:bg-primary/10"
                    : "hover:bg-foreground/4 dark:hover:bg-white/4"
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-3 rounded-r-full bg-primary" />
                )}
                <FolderOpen
                  size={13}
                  className={cn(
                    "shrink-0 transition-colors duration-150",
                    isActive ? "text-primary" : "text-foreground/20 group-hover:text-foreground/35"
                  )}
                />
                <span
                  className={cn(
                    "text-[11px] truncate flex-1 transition-colors duration-150",
                    isActive
                      ? "text-foreground font-medium"
                      : "text-foreground/50 group-hover:text-foreground/70"
                  )}
                >
                  {folder.name}
                </span>

                {isMeetings ? (
                  <span className="text-[7px] font-semibold uppercase tracking-wider text-foreground/20 bg-foreground/4 dark:bg-white/6 px-1.5 py-px rounded shrink-0">
                    Soon
                  </span>
                ) : (
                  <span
                    className={cn(
                      "text-[9px] tabular-nums shrink-0 transition-colors",
                      isActive ? "text-foreground/30" : "text-foreground/15 group-hover:text-foreground/25"
                    )}
                  >
                    {count > 0 ? count : ""}
                  </span>
                )}

                {!folder.is_default && (
                  <div className="hidden group-hover:flex items-center gap-0.5 absolute right-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenamingFolderId(folder.id);
                        setRenameValue(folder.name);
                      }}
                      className="p-0.5 rounded text-foreground/20 hover:text-foreground/50 transition-colors"
                    >
                      <Pencil size={9} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFolder(folder.id);
                      }}
                      className="p-0.5 rounded text-foreground/20 hover:text-destructive/60 transition-colors"
                    >
                      <Trash2 size={9} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {isCreatingFolder && (
            <div className="px-2">
              <input
                ref={newFolderInputRef}
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateFolder();
                  if (e.key === "Escape") {
                    setIsCreatingFolder(false);
                    setNewFolderName("");
                  }
                }}
                onBlur={handleCreateFolder}
                placeholder="Folder name"
                className="w-full h-6 bg-foreground/5 dark:bg-white/5 rounded px-2 text-[11px] text-foreground placeholder:text-foreground/20 outline-none border border-primary/30 focus:border-primary/50"
              />
            </div>
          )}
        </div>

        <div className="mx-3 h-px bg-border/10 dark:bg-white/4 my-2" />

        {/* Notes list */}
        {!isMeetingsFolder && (
          <>
            <div className="flex items-center justify-between px-3 py-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/25">
                Notes
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNewNote}
                className="h-5 w-5 rounded-md text-muted-foreground/30 hover:text-foreground/60 hover:bg-foreground/5"
              >
                <Plus size={13} />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={12} className="animate-spin text-foreground/15" />
                </div>
              ) : notes.length === 0 ? (
                <button
                  onClick={handleNewNote}
                  className="group flex flex-col items-center justify-center py-10 px-4 w-full hover:bg-foreground/2 transition-colors"
                >
                  <Plus
                    size={14}
                    className="text-foreground/10 mb-1.5 group-hover:text-foreground/20 transition-colors"
                  />
                  <p className="text-[10px] text-foreground/20 group-hover:text-foreground/30 transition-colors">
                    New note
                  </p>
                </button>
              ) : (
                notes.map((note) => (
                  <NoteListItem
                    key={note.id}
                    note={note}
                    isActive={note.id === activeNoteId}
                    onClick={() => setActiveNoteId(note.id)}
                    onDelete={handleDelete}
                  />
                ))
              )}
            </div>
          </>
        )}

        {isMeetingsFolder && <div className="flex-1" />}
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {isMeetingsFolder ? (
          <div className="flex flex-col items-center justify-center h-full">
            <Users size={18} className="text-foreground/8 mb-2.5" />
            <p className="text-[11px] text-foreground/25 mb-1">Meeting Notes</p>
            <p className="text-[9px] text-foreground/12 text-center max-w-48">
              Speaker identification & structured summaries
            </p>
            <span className="mt-2.5 text-[8px] font-medium uppercase tracking-wider text-foreground/15 bg-foreground/3 px-2 py-0.5 rounded-sm">
              Coming Soon
            </span>
          </div>
        ) : editorNote ? (
          <>
            <NoteEditor
              note={editorNote}
              onTitleChange={handleTitleChange}
              onContentChange={handleContentChange}
              isSaving={isSaving}
              isRecording={isRecording}
              partialTranscript={partialTranscript}
              finalTranscript={finalTranscript}
              onFinalTranscriptConsumed={() => setFinalTranscript(null)}
              onStartRecording={startRecording}
              onStopRecording={stopRecording}
              onOpenEnhance={() => setShowEnhanceModal(true)}
              onExportNote={handleExportNote}
              hasEnhancedContent={!!activeNote?.enhanced_content}
              enhancedContent={activeNote?.enhanced_content ?? null}
              isEnhancementStale={isEnhancementStale}
            />
            <NoteEnhanceModal
              open={showEnhanceModal}
              onOpenChange={setShowEnhanceModal}
              noteContent={localContent}
              onApply={handleApplyEnhancement}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center">
            <NotebookPen size={16} className="text-foreground/6 mb-2" />
            <p className="text-[10px] text-foreground/12">
              {notes.length === 0 ? "Create a note to get started" : "Select a note"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
