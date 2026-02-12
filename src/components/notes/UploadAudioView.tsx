import React, { useState, useRef, useEffect, Suspense } from "react";
import {
  Upload,
  FileAudio,
  X,
  AlertCircle,
  Cloud,
  ChevronRight,
  Key,
  FolderOpen,
  Plus,
} from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Input } from "../ui/input";
import type { FolderItem } from "../../types/electron";
import { useAuth } from "../../hooks/useAuth";
import { useUsage } from "../../hooks/useUsage";
import { useSettings } from "../../hooks/useSettings";
import { withSessionRefresh } from "../../lib/neonAuth";
import reasoningService from "../../services/ReasoningService";
import { getAllReasoningModels } from "../../models/ModelRegistry";

const TranscriptionModelPicker = React.lazy(() => import("../TranscriptionModelPicker"));

type UploadState = "idle" | "selected" | "transcribing" | "complete" | "error";

const SUPPORTED_EXTENSIONS = ["mp3", "wav", "m4a", "webm", "ogg", "flac", "aac"];

const TITLE_SYSTEM_PROMPT =
  "Generate a concise 3-8 word title for these transcribed notes. Return ONLY the title text, nothing else — no quotes, no prefix, no explanation.";

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
  const [progress, setProgress] = useState(0);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const [setupDismissed, setSetupDismissed] = useState(
    () => localStorage.getItem("uploadSetupComplete") === "true"
  );
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const { isSignedIn } = useAuth();
  const usage = useUsage();
  const isProUser = usage?.isSubscribed || usage?.isTrial;

  const {
    useLocalWhisper,
    setUseLocalWhisper,
    whisperModel,
    setWhisperModel,
    localTranscriptionProvider,
    setLocalTranscriptionProvider,
    parakeetModel,
    setParakeetModel,
    cloudTranscriptionProvider,
    setCloudTranscriptionProvider,
    cloudTranscriptionModel,
    setCloudTranscriptionModel,
    cloudTranscriptionBaseUrl,
    setCloudTranscriptionBaseUrl,
    cloudTranscriptionMode,
    setCloudTranscriptionMode,
    openaiApiKey,
    setOpenaiApiKey,
    groqApiKey,
    setGroqApiKey,
    mistralApiKey,
    setMistralApiKey,
    customTranscriptionApiKey,
    setCustomTranscriptionApiKey,
    updateTranscriptionSettings,
    useReasoningModel,
    reasoningModel,
  } = useSettings();

  const isOpenWhisprCloud =
    isSignedIn && cloudTranscriptionMode === "openwhispr" && !useLocalWhisper;
  const showSetup = !isProUser && !setupDismissed && state === "idle";
  const showModelPicker = !isSignedIn || cloudTranscriptionMode === "byok" || useLocalWhisper;
  const shouldCenter = !showSetup && !advancedOpen;

  useEffect(() => {
    return () => {
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, []);

  useEffect(() => {
    window.electronAPI.getFolders?.().then((f) => {
      setFolders(f);
      const personal = f.find((x) => x.name === "Personal" && x.is_default);
      if (personal) setSelectedFolderId(String(personal.id));
    });
  }, []);

  const getActiveModelLabel = (): string => {
    if (isOpenWhisprCloud) return "OpenWhispr Cloud";
    if (useLocalWhisper) {
      if (localTranscriptionProvider === "nvidia")
        return `Parakeet · ${parakeetModel || "default"}`;
      return `Whisper · ${whisperModel || "base"}`;
    }
    const name =
      cloudTranscriptionProvider === "custom"
        ? "Custom"
        : cloudTranscriptionProvider.charAt(0).toUpperCase() + cloudTranscriptionProvider.slice(1);
    return `${name} · ${cloudTranscriptionModel}`;
  };

  const getActiveApiKey = (): string => {
    switch (cloudTranscriptionProvider) {
      case "openai":
        return openaiApiKey;
      case "groq":
        return groqApiKey;
      case "mistral":
        return mistralApiKey;
      case "custom":
        return customTranscriptionApiKey || "";
      default:
        return "";
    }
  };

  const generateTitle = async (text: string): Promise<string> => {
    if (!useReasoningModel) return "";
    const model = reasoningModel || getAllReasoningModels()[0]?.value;
    if (!model) return "";
    try {
      const title = await reasoningService.processText(text.slice(0, 2000), model, null, {
        systemPrompt: TITLE_SYSTEM_PROMPT,
        temperature: 0.3,
      });
      const cleaned = title.trim().replace(/^["']|["']$/g, "");
      return cleaned.length > 0 && cleaned.length < 100 ? cleaned : "";
    } catch {
      return "";
    }
  };

  const handleBrowse = async () => {
    const res = await window.electronAPI.selectAudioFile();
    if (!res.canceled && res.filePath) {
      const name = res.filePath.split(/[/\\]/).pop() || "audio";
      setFile({ name, path: res.filePath, size: "" });
      setState("selected");
      setError(null);
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
    if (progressRef.current) clearInterval(progressRef.current);
    setState("idle");
    setFile(null);
    setResult(null);
    setNoteId(null);
    setError(null);
    setProgress(0);
    const personal = folders.find((f) => f.name === "Personal" && f.is_default);
    if (personal) setSelectedFolderId(String(personal.id));
  };

  const handleTranscribe = async () => {
    if (!file) return;
    setState("transcribing");
    setError(null);
    setProgress(0);

    progressRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          if (progressRef.current) clearInterval(progressRef.current);
          return prev;
        }
        return prev + Math.random() * 6;
      });
    }, 500);

    try {
      let res: { success: boolean; text?: string; error?: string; code?: string };

      if (isOpenWhisprCloud) {
        res = await withSessionRefresh(async () => {
          const r = await window.electronAPI.transcribeAudioFileCloud!(file.path);
          if (!r.success && r.code) {
            const err = new Error(r.error || "Cloud transcription failed");
            (err as any).code = r.code;
            throw err;
          }
          return r;
        });
      } else if (useLocalWhisper) {
        res = await window.electronAPI.transcribeAudioFile(file.path);
      } else {
        res = await window.electronAPI.transcribeAudioFileByok!({
          filePath: file.path,
          apiKey: getActiveApiKey(),
          baseUrl: cloudTranscriptionBaseUrl || "",
          model: cloudTranscriptionModel,
        });
      }

      if (progressRef.current) clearInterval(progressRef.current);

      if (res.success && res.text) {
        setProgress(100);
        setResult(res.text);

        const fallbackTitle = file.name.replace(/\.[^.]+$/, "");
        const aiTitle = await generateTitle(res.text);
        const title = aiTitle || fallbackTitle;

        const folderId = selectedFolderId ? Number(selectedFolderId) : null;
        const noteRes = await window.electronAPI.saveNote(
          title,
          res.text,
          "upload",
          file.name,
          null,
          folderId
        );
        if (noteRes.success && noteRes.note) setNoteId(noteRes.note.id);
        setState("complete");
      } else {
        setProgress(0);
        setError(res.error || "Transcription failed");
        setState("error");
      }
    } catch (err) {
      if (progressRef.current) clearInterval(progressRef.current);
      setProgress(0);
      setError(err instanceof Error ? err.message : "An error occurred");
      setState("error");
    }
  };

  const dismissSetup = () => {
    localStorage.setItem("uploadSetupComplete", "true");
    setSetupDismissed(true);
  };

  const handleCreateFolder = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    const res = await window.electronAPI.createFolder(trimmed);
    if (res.success && res.folder) {
      setFolders((prev) => [...prev, res.folder!]);
      const newId = String(res.folder.id);
      setSelectedFolderId(newId);
      if (noteId != null) {
        window.electronAPI.updateNote(noteId, { folder_id: res.folder.id });
      }
    }
    setNewFolderName("");
    setShowNewFolderDialog(false);
  };

  const handleFolderChange = (val: string) => {
    if (val === "__create_new__") {
      setShowNewFolderDialog(true);
      return;
    }
    setSelectedFolderId(val);
    if (noteId != null) {
      window.electronAPI.updateNote(noteId, { folder_id: Number(val) });
    }
  };

  const getTranscribingLabel = (): string => {
    if (isOpenWhisprCloud) return "Transcribing via cloud...";
    if (useLocalWhisper) return "Transcribing locally...";
    return `Transcribing via ${cloudTranscriptionProvider}...`;
  };

  const modeSelector = isSignedIn ? (
    <div className="flex items-center rounded-md border border-foreground/6 dark:border-white/6 bg-surface-1/30 dark:bg-white/[0.02] p-0.5 mb-3">
      <button
        onClick={() => {
          setCloudTranscriptionMode("openwhispr");
          setUseLocalWhisper(false);
          updateTranscriptionSettings({ useLocalWhisper: false });
        }}
        className={cn(
          "flex-1 flex items-center justify-center gap-1.5 h-7 rounded text-[10px] font-medium transition-all duration-150",
          isOpenWhisprCloud
            ? "bg-foreground/[0.06] dark:bg-white/8 text-foreground/70"
            : "text-foreground/30 hover:text-foreground/50"
        )}
      >
        <Cloud size={11} />
        OpenWhispr Cloud
      </button>
      <button
        onClick={() => setCloudTranscriptionMode("byok")}
        className={cn(
          "flex-1 flex items-center justify-center gap-1.5 h-7 rounded text-[10px] font-medium transition-all duration-150",
          !isOpenWhisprCloud
            ? "bg-foreground/[0.06] dark:bg-white/8 text-foreground/70"
            : "text-foreground/30 hover:text-foreground/50"
        )}
      >
        <Key size={11} />
        Custom
      </button>
    </div>
  ) : null;

  const modelPicker = showModelPicker ? (
    <Suspense fallback={null}>
      <TranscriptionModelPicker
        selectedCloudProvider={cloudTranscriptionProvider}
        onCloudProviderSelect={setCloudTranscriptionProvider}
        selectedCloudModel={cloudTranscriptionModel}
        onCloudModelSelect={setCloudTranscriptionModel}
        selectedLocalModel={localTranscriptionProvider === "nvidia" ? parakeetModel : whisperModel}
        onLocalModelSelect={(modelId) => {
          if (localTranscriptionProvider === "nvidia") {
            setParakeetModel(modelId);
          } else {
            setWhisperModel(modelId);
          }
        }}
        selectedLocalProvider={localTranscriptionProvider}
        onLocalProviderSelect={(id) => setLocalTranscriptionProvider(id as "whisper" | "nvidia")}
        useLocalWhisper={useLocalWhisper}
        onModeChange={(isLocal) => {
          setUseLocalWhisper(isLocal);
          updateTranscriptionSettings({ useLocalWhisper: isLocal });
          if (isLocal) setCloudTranscriptionMode("byok");
        }}
        openaiApiKey={openaiApiKey}
        setOpenaiApiKey={setOpenaiApiKey}
        groqApiKey={groqApiKey}
        setGroqApiKey={setGroqApiKey}
        mistralApiKey={mistralApiKey}
        setMistralApiKey={setMistralApiKey}
        customTranscriptionApiKey={customTranscriptionApiKey}
        setCustomTranscriptionApiKey={setCustomTranscriptionApiKey}
        cloudTranscriptionBaseUrl={cloudTranscriptionBaseUrl}
        setCloudTranscriptionBaseUrl={setCloudTranscriptionBaseUrl}
        variant="settings"
      />
    </Suspense>
  ) : null;

  return (
    <div className="flex flex-col items-center h-full overflow-y-auto px-6">
      <div
        className={cn("w-full max-w-md shrink-0", shouldCenter ? "my-auto" : "pt-4 pb-8")}
        style={{ animation: "float-up 0.4s ease-out" }}
      >
        {showSetup && (
          <div className="mb-6" style={{ animation: "float-up 0.3s ease-out" }}>
            <div className="flex flex-col items-center mb-5">
              <div className="w-10 h-10 rounded-[10px] bg-gradient-to-b from-primary/10 to-primary/[0.03] dark:from-primary/15 dark:to-primary/5 border border-primary/15 dark:border-primary/20 flex items-center justify-center mb-3">
                <Upload size={17} strokeWidth={1.5} className="text-primary/50" />
              </div>
              <h2 className="text-[13px] font-semibold text-foreground mb-1">
                Set up transcription
              </h2>
              <p className="text-[11px] text-foreground/30 text-center leading-relaxed max-w-[280px]">
                Choose how to transcribe your audio. This also applies to live dictation.
              </p>
            </div>

            {modeSelector}
            {modelPicker}

            <div className="flex justify-center mt-4">
              <Button
                variant="default"
                size="sm"
                onClick={dismissSetup}
                className="h-8 text-[11px] px-6"
              >
                Continue
              </Button>
            </div>

            <div className="h-px bg-foreground/5 dark:bg-white/5 my-5" />
          </div>
        )}

        <div className="max-w-[320px] mx-auto">
          {state === "idle" && (
            <>
              <div className="flex flex-col items-center mb-5">
                <div className="w-10 h-10 rounded-[10px] bg-gradient-to-b from-foreground/5 to-foreground/[0.02] dark:from-white/8 dark:to-white/3 border border-foreground/8 dark:border-white/8 flex items-center justify-center mb-4">
                  <Upload
                    size={17}
                    strokeWidth={1.5}
                    className="text-foreground/25 dark:text-foreground/35"
                  />
                </div>
                <h2 className="text-[13px] font-semibold text-foreground mb-1">Upload Audio</h2>
                <p className="text-[10px] text-foreground/25">Using {getActiveModelLabel()}</p>
              </div>

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
                onClick={handleBrowse}
                className={cn(
                  "relative rounded-lg p-8 text-center cursor-pointer transition-all duration-300 group",
                  "bg-surface-1/40 dark:bg-white/[0.03] backdrop-blur-sm",
                  "border border-foreground/6 dark:border-white/6",
                  "hover:bg-surface-1/60 dark:hover:bg-white/[0.05] hover:border-foreground/12 dark:hover:border-white/10",
                  isDragOver &&
                    "border-primary/30 bg-primary/[0.04] dark:bg-primary/[0.06] scale-[1.01]"
                )}
                style={
                  isDragOver ? { animation: "drag-pulse 1.5s ease-in-out infinite" } : undefined
                }
              >
                <div className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  <div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/[0.02] dark:via-white/[0.03] to-transparent"
                    style={{ animation: "shimmer-slide 3s ease-in-out infinite" }}
                  />
                </div>

                {!isDragOver ? (
                  <div className="flex flex-col items-center gap-2 relative">
                    <div className="w-8 h-8 rounded-full bg-foreground/[0.03] dark:bg-white/[0.04] flex items-center justify-center mb-1">
                      <Upload
                        size={14}
                        className="text-foreground/20 dark:text-foreground/30 group-hover:text-foreground/40 transition-colors"
                      />
                    </div>
                    <p className="text-[11px] text-foreground/35 group-hover:text-foreground/50 transition-colors">
                      Drop audio file or click to browse
                    </p>
                    <p className="text-[9px] text-foreground/15 tracking-wide">
                      MP3, WAV, M4A, WebM, OGG, FLAC, AAC
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 relative">
                    <Upload size={18} className="text-primary/60" />
                    <p className="text-[11px] text-primary/60 font-medium">Drop to upload</p>
                  </div>
                )}
              </div>
            </>
          )}

          {state === "selected" && file && (
            <div style={{ animation: "float-up 0.3s ease-out" }}>
              <div className="rounded-lg border border-foreground/8 dark:border-white/6 bg-surface-1/40 dark:bg-white/[0.03] backdrop-blur-sm p-4 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[8px] bg-primary/8 dark:bg-primary/12 border border-primary/10 dark:border-primary/15 flex items-center justify-center shrink-0">
                    <FileAudio size={15} className="text-primary/60" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] text-foreground/70 truncate font-medium">
                      {file.name}
                    </p>
                    {file.size && (
                      <p className="text-[10px] text-foreground/25 mt-0.5">{file.size}</p>
                    )}
                    <p className="text-[9px] text-foreground/20 mt-0.5">{getActiveModelLabel()}</p>
                  </div>
                  <button
                    onClick={reset}
                    className="text-foreground/15 hover:text-foreground/40 transition-colors p-1 rounded"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 justify-center">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleTranscribe}
                  className="h-8 text-[11px] px-5"
                >
                  Transcribe
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={reset}
                  className="h-8 text-[11px] text-foreground/35"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {state === "transcribing" && (
            <div
              className="flex flex-col items-center"
              style={{ animation: "float-up 0.3s ease-out" }}
            >
              <div className="flex items-end justify-center gap-[3px] h-10 mb-5">
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="w-[3px] rounded-full bg-primary/40 dark:bg-primary/50 origin-bottom"
                    style={{
                      height: "100%",
                      animation: `waveform-bar ${0.8 + i * 0.12}s ease-in-out infinite`,
                      animationDelay: `${i * 0.08}s`,
                    }}
                  />
                ))}
              </div>

              <div className="w-full max-w-[200px] h-[3px] rounded-full bg-foreground/5 dark:bg-white/5 overflow-hidden mb-3">
                <div
                  className="h-full rounded-full bg-primary/50 transition-all duration-500 ease-out"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>

              <p className="text-[11px] text-foreground/50 font-medium">{getTranscribingLabel()}</p>
              {file && (
                <p className="text-[9px] text-foreground/20 mt-1 truncate max-w-[200px]">
                  {file.name}
                </p>
              )}
            </div>
          )}

          {state === "complete" && result && (
            <div
              className="flex flex-col items-center"
              style={{ animation: "float-up 0.3s ease-out" }}
            >
              <div className="relative w-12 h-12 mb-4">
                <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                  <circle
                    cx="18"
                    cy="18"
                    r="15"
                    fill="none"
                    strokeWidth="1.5"
                    className="stroke-success/15"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="15"
                    fill="none"
                    strokeWidth="1.5"
                    className="stroke-success/60"
                    strokeDasharray="94.25"
                    strokeLinecap="round"
                    style={{ animation: "ring-fill 0.8s ease-out forwards" }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg className="w-5 h-5 text-success/70" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5 13l4 4L19 7"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="24"
                      strokeDashoffset="24"
                      style={{ animation: "draw-check 0.4s ease-out 0.5s forwards" }}
                    />
                  </svg>
                </div>
              </div>

              <p className="text-[12px] text-foreground/60 font-medium mb-1">
                Transcription complete
              </p>
              <p className="text-[9px] text-foreground/25 max-w-[240px] text-center line-clamp-2 mb-4">
                {result.slice(0, 150)}
              </p>

              {folders.length > 0 && (
                <div className="flex items-center justify-center gap-2 mb-4">
                  <FolderOpen size={12} className="text-foreground/20 shrink-0" />
                  <Select value={selectedFolderId} onValueChange={handleFolderChange}>
                    <SelectTrigger className="h-7 w-44 text-[11px] rounded-lg px-2.5 [&>svg]:h-3 [&>svg]:w-3">
                      <SelectValue placeholder="Select folder" />
                    </SelectTrigger>
                    <SelectContent>
                      {folders.map((f) => {
                        const isMeetings = f.name === "Meetings" && !!f.is_default;
                        return (
                          <SelectItem
                            key={f.id}
                            value={String(f.id)}
                            disabled={isMeetings}
                            className="text-[11px] py-1.5 pl-2.5 pr-7 rounded-md"
                          >
                            <span className="flex items-center gap-1.5">
                              {f.name}
                              {isMeetings && (
                                <span className="text-[8px] uppercase tracking-wider text-foreground/25 font-medium">
                                  Soon
                                </span>
                              )}
                            </span>
                          </SelectItem>
                        );
                      })}
                      <SelectSeparator />
                      <SelectItem
                        value="__create_new__"
                        className="text-[11px] py-1.5 pl-2.5 pr-7 rounded-md"
                      >
                        <span className="flex items-center gap-1.5 text-primary/60">
                          <Plus size={11} />
                          New Folder
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex items-center gap-2">
                {noteId != null && onNoteCreated && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onNoteCreated(noteId)}
                    className="h-8 text-[11px]"
                  >
                    Open Note
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={reset}
                  className="h-8 text-[11px] text-foreground/35"
                >
                  Upload Another
                </Button>
              </div>
            </div>
          )}

          {state === "error" && error && (
            <div style={{ animation: "float-up 0.3s ease-out" }}>
              <div className="rounded-lg border border-destructive/15 dark:border-destructive/20 bg-destructive/[0.03] dark:bg-destructive/[0.05] backdrop-blur-sm p-4 mb-4">
                <div className="flex items-start gap-2.5">
                  <AlertCircle size={14} className="text-destructive/50 shrink-0 mt-0.5" />
                  <p className="flex-1 text-[11px] text-destructive/70 leading-relaxed">{error}</p>
                  <button
                    onClick={reset}
                    className="text-foreground/15 hover:text-foreground/30 transition-colors shrink-0 p-0.5 rounded"
                  >
                    <X size={11} />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleTranscribe}
                  className="h-7 text-[10px] text-foreground/40"
                >
                  Retry
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={reset}
                  className="h-7 text-[10px] text-foreground/25"
                >
                  Start Over
                </Button>
              </div>
            </div>
          )}
        </div>

        {!showSetup && (state === "idle" || state === "selected") && (
          <div className="mx-auto mt-5" style={{ maxWidth: advancedOpen ? "448px" : "320px" }}>
            <button
              onClick={() => setAdvancedOpen(!advancedOpen)}
              className="flex items-center gap-1.5 text-[10px] text-foreground/25 hover:text-foreground/40 transition-colors mx-auto"
            >
              <ChevronRight
                size={10}
                className={cn("transition-transform duration-200", advancedOpen && "rotate-90")}
              />
              Transcription Settings
            </button>

            {advancedOpen && (
              <div className="mt-3" style={{ animation: "float-up 0.2s ease-out" }}>
                {modeSelector}
                {modelPicker}
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <DialogContent className="sm:max-w-[320px] p-5 gap-3">
          <DialogHeader>
            <DialogTitle className="text-[14px]">New Folder</DialogTitle>
          </DialogHeader>
          <Input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name"
            className="h-8 text-[12px]"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateFolder();
            }}
          />
          <DialogFooter className="gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowNewFolderDialog(false);
                setNewFolderName("");
              }}
              className="h-7 text-[11px]"
            >
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim()}
              className="h-7 text-[11px]"
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
