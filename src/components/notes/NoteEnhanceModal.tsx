import { useState, useEffect } from "react";
import { Sparkles, Loader2, ChevronDown } from "lucide-react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { MarkdownRenderer } from "../ui/MarkdownRenderer";
import reasoningService from "../../services/ReasoningService";
import { getAllReasoningModels } from "../../models/ModelRegistry";
import { cn } from "../lib/utils";

interface NoteEnhanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteContent: string;
  onApply: (enhancedContent: string, prompt: string) => void;
}

type ModalState = "idle" | "enhancing" | "preview" | "error";

const DEFAULT_PROMPT =
  "Clean up grammar, improve structure, and format these notes for readability while preserving all original meaning.";

const BASE_SYSTEM_PROMPT =
  "You are a note enhancement assistant. The user will provide raw notes — possibly voice-transcribed, rough, or unstructured. Your job is to clean them up according to the instructions below while preserving all original meaning and information. Output clean markdown.\n\nInstructions: ";

export default function NoteEnhanceModal({
  open,
  onOpenChange,
  noteContent,
  onApply,
}: NoteEnhanceModalProps) {
  const [state, setState] = useState<ModalState>("idle");
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [selectedModel, setSelectedModel] = useState("");

  const models = getAllReasoningModels();

  useEffect(() => {
    if (open && !selectedModel) {
      const stored = localStorage.getItem("reasoningModel") || "";
      if (stored && models.some((m) => m.value === stored)) {
        setSelectedModel(stored);
      } else if (models.length > 0) {
        setSelectedModel(models[0].value);
      }
    }
  }, [open, selectedModel, models]);

  useEffect(() => {
    if (open) {
      setState("idle");
      setResult("");
      setError("");
    }
  }, [open]);

  const handleEnhance = async () => {
    if (!selectedModel || !noteContent.trim()) return;

    setState("enhancing");
    setError("");

    try {
      const systemPrompt = BASE_SYSTEM_PROMPT + prompt;
      const enhanced = await reasoningService.processText(noteContent, selectedModel, null, {
        systemPrompt,
        temperature: 0.3,
      });

      setResult(enhanced);
      setState("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enhancement failed");
      setState("error");
    }
  };

  const handleApply = () => {
    onApply(result, prompt);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md gap-2.5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[14px]">
            <Sparkles size={13} className="text-primary" />
            Enhance with AI
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={state === "enhancing"}
            className={cn(
              "w-full h-8 px-3 pr-8 rounded-md text-[12px] appearance-none",
              "bg-foreground/3 dark:bg-white/4 border border-border/30 dark:border-white/6",
              "text-foreground/80 outline-none",
              "focus:border-primary/30 transition-colors duration-150",
              "disabled:opacity-40"
            )}
          >
            {models.map((m) => (
              <option key={m.value} value={m.value}>
                {m.fullLabel}
              </option>
            ))}
          </select>
          <ChevronDown
            size={12}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground/30 pointer-events-none"
          />
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={state === "enhancing"}
          placeholder="What should the AI do with your notes?"
          rows={3}
          className={cn(
            "w-full px-3 py-2 rounded-md text-[12px] leading-relaxed resize-none",
            "bg-foreground/3 dark:bg-white/4 border border-border/30 dark:border-white/6",
            "text-foreground/80 placeholder:text-foreground/20 outline-none",
            "focus:border-primary/30 transition-colors duration-150",
            "disabled:opacity-40"
          )}
        />

        {state === "preview" && result && (
          <div className="max-h-48 overflow-y-auto rounded-md border border-border/20 dark:border-white/4 bg-foreground/2 dark:bg-white/2 px-3 py-2">
            <div className="text-[12px] leading-relaxed">
              <MarkdownRenderer content={result} />
            </div>
          </div>
        )}

        {state === "error" && error && (
          <p className="text-[11px] text-destructive/80 px-1">{error}</p>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          {state === "preview" ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setState("idle")}
                className="h-7 text-[11px]"
              >
                Try Again
              </Button>
              <Button variant="default" size="sm" onClick={handleApply} className="h-7 text-[11px]">
                Apply
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={state === "enhancing"}
                className="h-7 text-[11px]"
              >
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleEnhance}
                disabled={state === "enhancing" || !selectedModel || !noteContent.trim()}
                className="h-7 text-[11px]"
              >
                {state === "enhancing" ? (
                  <>
                    <Loader2 size={12} className="animate-spin mr-1.5" />
                    Enhancing...
                  </>
                ) : (
                  "Enhance"
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
