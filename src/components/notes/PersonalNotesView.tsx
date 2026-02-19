import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Loader2, FolderOpen, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";
import { useToast } from "../ui/Toast";
import NoteListItem from "./NoteListItem";
import NoteEditor from "./NoteEditor";
import ActionPicker from "./ActionPicker";
import ActionManagerDialog from "./ActionManagerDialog";
import AddNotesToFolderDialog from "./AddNotesToFolderDialog";
import { useNoteRecording } from "../../hooks/useNoteRecording";
import { useActionProcessing } from "../../hooks/useActionProcessing";
import { cn } from "../lib/utils";
import type { FolderItem } from "../../types/electron";
import {
  useNotes,
  useActiveNoteId,
  useActiveFolderId,
  initializeNotes,
  setActiveNoteId,
  setActiveFolderId,
  getActiveFolderIdValue,
} from "../../stores/noteStore";

export default function PersonalNotesView() {
  const { t } = useTranslation();
  const MEETINGS_FOLDER_NAME = t("notes.folders.meetings");
  const notes = useNotes();
  const activeNoteId = useActiveNoteId();
  const activeFolderId = useActiveFolderId();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [localTitle, setLocalTitle] = useState("");
  const [localContent, setLocalContent] = useState("");
  const [localEnhancedContent, setLocalEnhancedContent] = useState<string | null>(null);
  const [finalTranscript, setFinalTranscript] = useState<string | null>(null);
  const [showActionManager, setShowActionManager] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const enhancedSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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
  const [showAddNotesDialog, setShowAddNotesDialog] = useState(false);
  const newFolderInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const prevFolderIdRef = useRef<number | null>(null);

  const activeNote = notes.find((n) => n.id === activeNoteId) ?? null;
  const isMeetingsFolder = useMemo(
    () => folders.find((f) => f.id === activeFolderId)?.name === MEETINGS_FOLDER_NAME,
    [folders, activeFolderId]
  );

  const { isRecording, isProcessing, partialTranscript, startRecording, stopRecording } =
    useNoteRecording({
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

        // Respect pre-set activeFolderId (e.g., navigating from "Open Note")
        const presetFolderId = getActiveFolderIdValue();
        const isPresetValid = presetFolderId != null && items.some((f) => f.id === presetFolderId);

        const initialFolderId = isPresetValid
          ? presetFolderId
          : (items.find((f) => f.name === "Personal" && f.is_default)?.id ?? items[0]?.id ?? null);

        if (initialFolderId !== presetFolderId) {
          setActiveFolderId(initialFolderId);
        }
        if (initialFolderId) {
          await initializeNotes(null, 50, initialFolderId);
        }
        prevFolderIdRef.current = initialFolderId;
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [loadFolders]);

  useEffect(() => {
    if (!activeFolderId || isLoading) return;
    // Skip if folder hasn't changed (e.g., initial load completing)
    if (prevFolderIdRef.current === activeFolderId) return;
    prevFolderIdRef.current = activeFolderId;
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
      setLocalEnhancedContent(activeNote.enhanced_content ?? null);
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
      if (enhancedSaveTimeoutRef.current) clearTimeout(enhancedSaveTimeoutRef.current);
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

  const handleEnhancedContentChange = useCallback(
    (content: string) => {
      setLocalEnhancedContent(content);
      if (!activeNoteId) return;
      if (enhancedSaveTimeoutRef.current) clearTimeout(enhancedSaveTimeoutRef.current);
      enhancedSaveTimeoutRef.current = setTimeout(async () => {
        setIsSaving(true);
        try {
          await window.electronAPI.updateNote(activeNoteId, { enhanced_content: content });
        } finally {
          setIsSaving(false);
        }
      }, 1000);
    },
    [activeNoteId]
  );

  const handleNewNote = useCallback(async () => {
    if (!activeFolderId || isMeetingsFolder) return;
    const result = await window.electronAPI.saveNote(
      t("notes.list.untitledNote"),
      "",
      "personal",
      null,
      null,
      activeFolderId
    );
    if (result.success && result.note) {
      setActiveNoteId(result.note.id);
      loadFolders();
    }
  }, [activeFolderId, isMeetingsFolder, loadFolders]);

  const handleNotesAdded = useCallback(async () => {
    if (activeFolderId) {
      await initializeNotes(null, 50, activeFolderId);
    }
    loadFolders();
  }, [activeFolderId, loadFolders]);

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

  const handleMoveToFolder = useCallback(
    async (noteId: number, folderId: number) => {
      await window.electronAPI.updateNote(noteId, { folder_id: folderId });
      if (activeFolderId) await initializeNotes(null, 50, activeFolderId);
      loadFolders();
    },
    [activeFolderId, loadFolders]
  );

  const handleCreateFolderAndMove = useCallback(
    async (noteId: number, folderName: string) => {
      const result = await window.electronAPI.createFolder(folderName);
      if (result.success && result.folder) {
        await window.electronAPI.updateNote(noteId, { folder_id: result.folder.id });
        if (activeFolderId) await initializeNotes(null, 50, activeFolderId);
        await loadFolders();
      } else if (result.error) {
        toast({
          title: t("notes.folders.couldNotCreate"),
          description: result.error,
          variant: "destructive",
        });
      }
    },
    [activeFolderId, loadFolders, toast, t]
  );

  const handleApplyEnhancement = useCallback(
    async (enhancedContent: string, prompt: string) => {
      if (!activeNoteId) return;
      setLocalEnhancedContent(enhancedContent);
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
    },
    [activeNoteId]
  );

  const {
    state: actionProcessingState,
    actionName,
    runAction,
    cancel: cancelAction,
  } = useActionProcessing({
    onSuccess: useCallback(
      (enhancedContent: string, prompt: string) => {
        handleApplyEnhancement(enhancedContent, prompt);
      },
      [handleApplyEnhancement]
    ),
    onError: useCallback(
      (errorMessage: string) => {
        toast({
          title: t("notes.enhance.title"),
          description: errorMessage,
          variant: "destructive",
        });
      },
      [toast, t]
    ),
  });

  useEffect(() => {
    return () => cancelAction();
  }, [activeNoteId, cancelAction]);

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
      toast({
        title: t("notes.folders.couldNotCreate"),
        description: result.error,
        variant: "destructive",
      });
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
      toast({
        title: t("notes.folders.couldNotRename"),
        description: result.error,
        variant: "destructive",
      });
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
        toast({
          title: t("notes.folders.couldNotDelete"),
          description: result.error,
          variant: "destructive",
        });
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
            {t("notes.folders.title")}
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
                    {t("notes.folders.soon")}
                  </span>
                ) : (
                  <>
                    <span
                      className={cn(
                        "text-[9px] tabular-nums shrink-0 transition-colors group-hover:opacity-0",
                        isActive ? "text-foreground/30" : "text-foreground/15"
                      )}
                    >
                      {count > 0 ? count : ""}
                    </span>
                    {!folder.is_default && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 flex items-center justify-center rounded-sm opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 transition-opacity absolute right-1.5 text-foreground/25 hover:text-foreground/50"
                          >
                            <MoreHorizontal size={11} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" sideOffset={4} className="min-w-32">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenamingFolderId(folder.id);
                              setRenameValue(folder.name);
                            }}
                            className="text-[11px] gap-2 rounded-md px-2 py-1"
                          >
                            <Pencil size={11} className="text-muted-foreground/60" />
                            {t("notes.context.rename")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteFolder(folder.id);
                            }}
                            className="text-[11px] gap-2 rounded-md px-2 py-1 text-destructive focus:text-destructive focus:bg-destructive/10"
                          >
                            <Trash2 size={11} />
                            {t("notes.context.delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </>
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
                placeholder={t("notes.folders.folderName")}
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
                {t("notes.list.title")}
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
                <div className="flex flex-col items-center justify-center py-8 px-4">
                  <svg
                    className="text-foreground dark:text-white mb-3"
                    width="40"
                    height="36"
                    viewBox="0 0 40 36"
                    fill="none"
                  >
                    <rect
                      x="12"
                      y="1"
                      width="20"
                      height="26"
                      rx="2"
                      transform="rotate(5 22 14)"
                      fill="currentColor"
                      fillOpacity={0.025}
                      stroke="currentColor"
                      strokeOpacity={0.06}
                    />
                    <rect
                      x="8"
                      y="3"
                      width="20"
                      height="26"
                      rx="2"
                      fill="currentColor"
                      fillOpacity={0.04}
                      stroke="currentColor"
                      strokeOpacity={0.08}
                    />
                    <rect
                      x="12"
                      y="9"
                      width="10"
                      height="1.5"
                      rx="0.75"
                      fill="currentColor"
                      fillOpacity={0.07}
                    />
                    <rect
                      x="12"
                      y="13"
                      width="12"
                      height="1.5"
                      rx="0.75"
                      fill="currentColor"
                      fillOpacity={0.05}
                    />
                    <rect
                      x="12"
                      y="17"
                      width="8"
                      height="1.5"
                      rx="0.75"
                      fill="currentColor"
                      fillOpacity={0.04}
                    />
                  </svg>
                  <p className="text-[10px] text-foreground/25 mb-3">
                    {t("notes.empty.emptyFolder")}
                  </p>
                  <div className="flex flex-col gap-1.5 w-full max-w-36">
                    <button
                      onClick={handleNewNote}
                      className="flex items-center justify-center gap-1.5 h-6 rounded-md bg-primary/8 dark:bg-primary/10 border border-primary/12 dark:border-primary/15 text-[10px] font-medium text-primary/70 hover:bg-primary/12 hover:text-primary hover:border-primary/20 transition-all"
                    >
                      <Plus size={10} />
                      {t("notes.empty.createNote")}
                    </button>
                    <button
                      onClick={() => setShowAddNotesDialog(true)}
                      className="flex items-center justify-center gap-1.5 h-6 rounded-md border border-foreground/8 dark:border-white/8 text-[10px] text-foreground/40 hover:text-foreground/60 hover:border-foreground/15 hover:bg-foreground/3 dark:hover:bg-white/3 transition-all"
                    >
                      {t("notes.addToFolder.addExisting")}
                    </button>
                  </div>
                </div>
              ) : (
                notes.map((note) => (
                  <NoteListItem
                    key={note.id}
                    note={note}
                    isActive={note.id === activeNoteId}
                    onClick={() => setActiveNoteId(note.id)}
                    onDelete={handleDelete}
                    folders={folders}
                    currentFolderId={activeFolderId}
                    onMoveToFolder={handleMoveToFolder}
                    onCreateFolderAndMove={handleCreateFolderAndMove}
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
          <div className="flex flex-col items-center justify-center h-full -mt-6">
            <svg
              className="text-foreground dark:text-white mb-5"
              width="72"
              height="56"
              viewBox="0 0 72 56"
              fill="none"
            >
              <ellipse cx="36" cy="48" rx="24" ry="2" fill="currentColor" fillOpacity={0.03} />
              <circle
                cx="24"
                cy="20"
                r="7"
                fill="currentColor"
                fillOpacity={0.04}
                stroke="currentColor"
                strokeOpacity={0.08}
              />
              <path
                d="M13 40c0-6 5-11 11-11s11 5 11 11"
                fill="currentColor"
                fillOpacity={0.03}
                stroke="currentColor"
                strokeOpacity={0.06}
              />
              <circle
                cx="48"
                cy="20"
                r="7"
                fill="currentColor"
                fillOpacity={0.04}
                stroke="currentColor"
                strokeOpacity={0.08}
              />
              <path
                d="M37 40c0-6 5-11 11-11s11 5 11 11"
                fill="currentColor"
                fillOpacity={0.03}
                stroke="currentColor"
                strokeOpacity={0.06}
              />
              <rect
                x="16"
                y="6"
                width="14"
                height="8"
                rx="3"
                fill="currentColor"
                fillOpacity={0.04}
                stroke="currentColor"
                strokeOpacity={0.07}
              />
              <rect
                x="18.5"
                y="8.5"
                width="5"
                height="1"
                rx="0.5"
                fill="currentColor"
                fillOpacity={0.06}
              />
              <rect
                x="18.5"
                y="11"
                width="8"
                height="1"
                rx="0.5"
                fill="currentColor"
                fillOpacity={0.04}
              />
              <rect
                x="44"
                y="9"
                width="12"
                height="7"
                rx="2.5"
                fill="currentColor"
                fillOpacity={0.03}
                stroke="currentColor"
                strokeOpacity={0.06}
              />
              <rect
                x="46.5"
                y="11.5"
                width="4"
                height="1"
                rx="0.5"
                fill="currentColor"
                fillOpacity={0.05}
              />
            </svg>
            <h3 className="text-[13px] font-semibold text-foreground/60 mb-1">
              {t("notes.meeting.title")}
            </h3>
            <p className="text-[11px] text-foreground/25 text-center max-w-52 mb-3">
              {t("notes.meeting.description")}
            </p>
            <span className="text-[8px] font-semibold uppercase tracking-widest text-primary/40 bg-primary/5 dark:bg-primary/8 px-2.5 py-1 rounded-md border border-primary/8 dark:border-primary/12">
              {t("notes.meeting.comingSoon")}
            </span>
          </div>
        ) : editorNote ? (
          <>
            <NoteEditor
              note={editorNote}
              onTitleChange={handleTitleChange}
              onContentChange={handleContentChange}
              onEnhancedContentChange={handleEnhancedContentChange}
              isSaving={isSaving}
              isRecording={isRecording}
              isProcessing={isProcessing}
              partialTranscript={partialTranscript}
              finalTranscript={finalTranscript}
              onFinalTranscriptConsumed={() => setFinalTranscript(null)}
              onStartRecording={startRecording}
              onStopRecording={stopRecording}
              onExportNote={handleExportNote}
              hasEnhancedContent={!!localEnhancedContent}
              enhancedContent={localEnhancedContent}
              isEnhancementStale={isEnhancementStale}
              actionProcessingState={actionProcessingState}
              actionName={actionName}
              actionPicker={
                <ActionPicker
                  onRunAction={(action) => {
                    if (!localContent.trim()) return;
                    runAction(action, localContent);
                  }}
                  onManageActions={() => setShowActionManager(true)}
                  disabled={!localContent.trim() || actionProcessingState === "processing"}
                />
              }
            />
            <ActionManagerDialog open={showActionManager} onOpenChange={setShowActionManager} />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center -mt-6">
            <svg
              className="text-foreground dark:text-white mb-5"
              width="72"
              height="64"
              viewBox="0 0 72 64"
              fill="none"
            >
              <rect
                x="22"
                y="2"
                width="32"
                height="42"
                rx="3"
                transform="rotate(6 38 23)"
                fill="currentColor"
                fillOpacity={0.025}
                stroke="currentColor"
                strokeOpacity={0.06}
              />
              <rect
                x="18"
                y="5"
                width="32"
                height="42"
                rx="3"
                transform="rotate(3 34 26)"
                fill="currentColor"
                fillOpacity={0.04}
                stroke="currentColor"
                strokeOpacity={0.08}
              />
              <rect
                x="14"
                y="8"
                width="32"
                height="42"
                rx="3"
                fill="currentColor"
                fillOpacity={0.05}
                stroke="currentColor"
                strokeOpacity={0.1}
              />
              <rect
                x="20"
                y="16"
                width="16"
                height="2"
                rx="1"
                fill="currentColor"
                fillOpacity={0.08}
              />
              <rect
                x="20"
                y="21"
                width="20"
                height="2"
                rx="1"
                fill="currentColor"
                fillOpacity={0.06}
              />
              <rect
                x="20"
                y="26"
                width="12"
                height="2"
                rx="1"
                fill="currentColor"
                fillOpacity={0.05}
              />
              <rect
                x="20"
                y="31"
                width="18"
                height="2"
                rx="1"
                fill="currentColor"
                fillOpacity={0.04}
              />
              <circle
                cx="54"
                cy="50"
                r="5"
                fill="currentColor"
                fillOpacity={0.03}
                stroke="currentColor"
                strokeOpacity={0.06}
              />
              <path
                d="M51.5 50L53 51.5L56.5 48"
                stroke="currentColor"
                strokeOpacity={0.12}
                strokeWidth={1.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {notes.length === 0 ? (
              <>
                <h3 className="text-[13px] font-semibold text-foreground/60 mb-1">
                  {t("notes.empty.title")}
                </h3>
                <p className="text-[11px] text-foreground/25 text-center max-w-55 mb-4">
                  {t("notes.empty.description")}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleNewNote}
                    className="flex items-center gap-1.5 px-4 h-7 rounded-md bg-primary/8 dark:bg-primary/10 border border-primary/12 dark:border-primary/15 text-[11px] font-medium text-primary/70 hover:bg-primary/12 hover:text-primary hover:border-primary/20 transition-all"
                  >
                    <Plus size={11} />
                    {t("notes.empty.createNote")}
                  </button>
                  <button
                    onClick={() => setShowAddNotesDialog(true)}
                    className="flex items-center gap-1.5 px-4 h-7 rounded-md border border-foreground/8 dark:border-white/8 text-[11px] text-foreground/40 hover:text-foreground/60 hover:border-foreground/15 hover:bg-foreground/3 dark:hover:bg-white/3 transition-all"
                  >
                    {t("notes.addToFolder.addExisting")}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-[13px] font-semibold text-foreground/60 mb-1">
                  {t("notes.empty.selectTitle")}
                </h3>
                <p className="text-[11px] text-foreground/25 text-center max-w-50">
                  {t("notes.empty.selectDescription")}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {activeFolderId && (
        <AddNotesToFolderDialog
          open={showAddNotesDialog}
          onOpenChange={setShowAddNotesDialog}
          targetFolderId={activeFolderId}
          onNotesAdded={handleNotesAdded}
        />
      )}
    </div>
  );
}
