import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { MarkdownRenderer } from "../ui/MarkdownRenderer";
import reasoningService from "../../services/ReasoningService";
import NoteModelPicker from "./NoteModelPicker";
import { cn } from "../lib/utils";
import type { ActionItem } from "../../types/electron";

interface NoteEnhanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteContent: string;
  action: ActionItem | null;
  onApply: (enhancedContent: string, prompt: string) => void;
}

type ModalState = "idle" | "enhancing" | "preview" | "error";

const DEFAULT_PROMPT_FALLBACK =
  "Clean up grammar, improve structure, and format these notes for readability while preserving all original meaning.";

const BASE_SYSTEM_PROMPT =
  "You are a note enhancement assistant. The user will provide raw notes — possibly voice-transcribed, rough, or unstructured. Your job is to clean them up according to the instructions below while preserving all original meaning and information. Output clean markdown.\n\nInstructions: ";

const DEFAULT_CLOUD_MODEL = "gpt-5.2";

export default function NoteEnhanceModal({
  open,
  onOpenChange,
  noteContent,
  action,
  onApply,
}: NoteEnhanceModalProps) {
  const { t } = useTranslation();
  const [state, setState] = useState<ModalState>("idle");
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [selectedModel, setSelectedModel] = useState("");

  const isCloudMode =
    localStorage.getItem("isSignedIn") === "true" &&
    (localStorage.getItem("cloudReasoningMode") || "openwhispr") === "openwhispr";

  useEffect(() => {
    if (open && !selectedModel) {
      if (isCloudMode) {
        setSelectedModel(DEFAULT_CLOUD_MODEL);
      } else {
        setSelectedModel(localStorage.getItem("reasoningModel") || "");
      }
    }
  }, [open, selectedModel, isCloudMode]);

  useEffect(() => {
    if (open) {
      setPrompt(action?.prompt || t("notes.enhance.defaultPrompt") || DEFAULT_PROMPT_FALLBACK);
      setState("idle");
      setResult("");
      setError("");
    }
  }, [open, action]);

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
      setError(err instanceof Error ? err.message : t("notes.upload.enhancementFailed"));
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
            {action ? action.name : t("notes.enhance.title")}
          </DialogTitle>
        </DialogHeader>

        {!isCloudMode && (
          <NoteModelPicker
            selectedModel={selectedModel}
            onModelSelect={(modelId) => {
              setSelectedModel(modelId);
              localStorage.setItem("reasoningModel", modelId);
            }}
            disabled={state === "enhancing"}
          />
        )}

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={state === "enhancing"}
          placeholder={t("notes.enhance.placeholder")}
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
                {t("notes.enhance.tryAgain")}
              </Button>
              <Button variant="default" size="sm" onClick={handleApply} className="h-7 text-[11px]">
                {t("notes.enhance.apply")}
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
                {t("notes.enhance.cancel")}
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
                    {t("notes.enhance.enhancing")}
                  </>
                ) : (
                  t("notes.enhance.enhance")
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
