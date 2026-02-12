import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Plus, NotebookPen, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { useToast } from "../ui/Toast";
import NoteListItem from "./NoteListItem";
import NoteEditor from "./NoteEditor";
import NoteEnhanceModal from "./NoteEnhanceModal";
import { useNoteRecording } from "../../hooks/useNoteRecording";
import {
  useNotes,
  useActiveNoteId,
  initializeNotes,
  setActiveNoteId,
} from "../../stores/noteStore";

export default function PersonalNotesView() {
  const notes = useNotes();
  const activeNoteId = useActiveNoteId();
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

  const activeNote = notes.find((n) => n.id === activeNoteId) ?? null;

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

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        await initializeNotes(null);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

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
    const result = await window.electronAPI.saveNote("Untitled Note", "", "personal");
    if (result.success && result.note) {
      setActiveNoteId(result.note.id);
    }
  }, []);

  const handleDelete = useCallback(
    async (id: number) => {
      await window.electronAPI.deleteNote(id);
      if (activeNoteId === id) {
        const remaining = notes.filter((n) => n.id !== id);
        setActiveNoteId(remaining.length > 0 ? remaining[0].id : null);
      }
    },
    [activeNoteId, notes]
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

  const editorNote = activeNote
    ? { ...activeNote, title: localTitle, content: localContent }
    : null;

  return (
    <div className="flex h-full">
      <div className="w-52 shrink-0 border-r border-border/15 dark:border-white/4 flex flex-col">
        <div className="flex items-center justify-between px-3 py-2">
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
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {editorNote ? (
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
