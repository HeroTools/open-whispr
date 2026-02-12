import { useState } from "react";
import { Upload, FileAudio, Loader2, CheckCircle, X } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../lib/utils";

type UploadState = "idle" | "selected" | "transcribing" | "complete" | "error";

const SUPPORTED_EXTENSIONS = ["mp3", "wav", "m4a", "webm", "ogg", "flac", "aac"];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface UploadAudioViewProps {
  onNoteCreated?: (noteId: number) => void;
}

export default function UploadAudioView({ onNoteCreated }: UploadAudioViewProps) {
  const [state, setState] = useState<UploadState>("idle");
  const [file, setFile] = useState<{ name: string; path: string; size: string } | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [noteId, setNoteId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleBrowse = async () => {
    const res = await window.electronAPI.selectAudioFile();
    if (!res.canceled && res.filePath) {
      const name = res.filePath.split(/[/\\]/).pop() || "audio";
      setFile({ name, path: res.filePath, size: "" });
      setState("selected");
      setError(null);
    }
  };

  const handleTranscribe = async () => {
    if (!file) return;
    setState("transcribing");
    setError(null);
    try {
      const res = await window.electronAPI.transcribeAudioFile(file.path);
      if (res.success && res.text) {
        setResult(res.text);
        const title = file.name.replace(/\.[^.]+$/, "");
        const noteRes = await window.electronAPI.saveNote(
          title,
          res.text,
          "upload",
          file.name,
          null
        );
        if (noteRes.success && noteRes.note) setNoteId(noteRes.note.id);
        setState("complete");
      } else {
        setError(res.error || "Transcription failed");
        setState("error");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setState("error");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const f = e.dataTransfer.files[0];
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase() || "";
    if (SUPPORTED_EXTENSIONS.includes(ext)) {
      const filePath = window.electronAPI.getPathForFile(f);
      if (!filePath) return;
      setFile({ name: f.name, path: filePath, size: formatFileSize(f.size) });
      setState("selected");
      setError(null);
    }
  };

  const reset = () => {
    setState("idle");
    setFile(null);
    setResult(null);
    setNoteId(null);
    setError(null);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 -mt-4">
      <div className="w-full max-w-[300px]">
        {state === "idle" && (
          <div className="flex flex-col items-center mb-5">
            <div className="w-10 h-10 rounded-[10px] bg-gradient-to-b from-foreground/5 to-foreground/[0.02] dark:from-white/8 dark:to-white/3 border border-foreground/8 dark:border-white/8 flex items-center justify-center mb-4">
              <Upload
                size={17}
                strokeWidth={1.5}
                className="text-foreground/25 dark:text-foreground/35"
              />
            </div>
            <h2 className="text-[13px] font-semibold text-foreground mb-1">Upload Audio</h2>
            <p className="text-[11px] text-foreground/30 text-center leading-relaxed">
              Transcribe an audio file and save it as a note
            </p>
          </div>
        )}

        <div
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragOver(false);
          }}
          onClick={state === "idle" ? handleBrowse : undefined}
          className={cn(
            "relative rounded-lg border p-6 text-center transition-all duration-200",
            state === "idle" && "cursor-pointer",
            isDragOver
              ? "border-primary/30 bg-primary/3 dark:bg-primary/5 scale-[1.005]"
              : state === "idle"
                ? "border-dashed border-foreground/8 dark:border-white/6 hover:border-foreground/15 dark:hover:border-white/10 hover:bg-foreground/[0.01] dark:hover:bg-white/[0.02]"
                : "border-foreground/8 dark:border-white/6"
          )}
        >
          {state === "idle" && !isDragOver && (
            <div className="flex flex-col items-center gap-1.5">
              <p className="text-[11px] text-foreground/35">Drop audio file or click to browse</p>
              <p className="text-[9px] text-foreground/15 tracking-wide">
                MP3, WAV, M4A, WebM, OGG, FLAC, AAC
              </p>
            </div>
          )}

          {state === "idle" && isDragOver && (
            <div className="flex flex-col items-center gap-1.5">
              <Upload size={16} className="text-primary/60" />
              <p className="text-[11px] text-primary/60 font-medium">Drop to upload</p>
            </div>
          )}

          {state === "selected" && file && (
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2.5 max-w-full">
                <FileAudio size={14} className="text-foreground/25 shrink-0" />
                <div className="text-left min-w-0">
                  <p className="text-[11px] text-foreground/70 truncate">{file.name}</p>
                  {file.size && <p className="text-[9px] text-foreground/25">{file.size}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleTranscribe}
                  className="h-7 text-[11px]"
                >
                  Transcribe
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={reset}
                  className="h-7 text-[11px] text-foreground/35"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {state === "transcribing" && (
            <div className="flex flex-col items-center gap-2.5">
              <Loader2 size={16} className="animate-spin text-primary/50" />
              <div className="text-center">
                <p className="text-[11px] text-foreground/50">Transcribing...</p>
                {file && (
                  <p className="text-[9px] text-foreground/20 mt-0.5 truncate max-w-[200px] mx-auto">
                    {file.name}
                  </p>
                )}
              </div>
            </div>
          )}

          {state === "complete" && result && (
            <div className="flex flex-col items-center gap-3">
              <CheckCircle size={16} className="text-success/60" />
              <div className="text-center">
                <p className="text-[11px] text-foreground/60">Transcription complete</p>
                <p className="text-[9px] text-foreground/25 mt-1 max-w-[240px] mx-auto line-clamp-2">
                  {result.slice(0, 150)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {noteId != null && onNoteCreated && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onNoteCreated(noteId)}
                    className="h-7 text-[11px]"
                  >
                    Open Note
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={reset}
                  className="h-7 text-[11px] text-foreground/35"
                >
                  Upload Another
                </Button>
              </div>
            </div>
          )}

          {state === "error" && error && (
            <div className="flex flex-col items-center gap-2.5">
              <div className="flex items-start gap-2 max-w-full">
                <p className="flex-1 text-[10px] text-destructive/70 text-left">{error}</p>
                <button
                  onClick={reset}
                  className="text-foreground/15 hover:text-foreground/30 transition-colors shrink-0"
                >
                  <X size={11} />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleTranscribe}
                  className="h-6 text-[10px] text-foreground/40"
                >
                  Retry
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={reset}
                  className="h-6 text-[10px] text-foreground/25"
                >
                  Start Over
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
