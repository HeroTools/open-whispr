import { useState, useCallback } from "react";
import { BookOpen, X, CornerDownLeft, Info } from "lucide-react";
import { Input } from "./ui/input";
import { ConfirmDialog } from "./ui/dialog";
import { useSettings } from "../hooks/useSettings";

export default function DictionaryView() {
  const { customDictionary, setCustomDictionary } = useSettings();
  const [newWord, setNewWord] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const isEmpty = customDictionary.length === 0;

  const handleAdd = useCallback(() => {
    const words = newWord
      .split(",")
      .map((w) => w.trim())
      .filter((w) => w && !customDictionary.includes(w));
    if (words.length > 0) {
      setCustomDictionary([...customDictionary, ...words]);
      setNewWord("");
    }
  }, [newWord, customDictionary, setCustomDictionary]);

  const handleRemove = useCallback(
    (word: string) => {
      setCustomDictionary(customDictionary.filter((w) => w !== word));
    },
    [customDictionary, setCustomDictionary]
  );

  return (
    <div className="flex flex-col h-full">
      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear dictionary?"
        description="This will remove all words from your custom dictionary. This action cannot be undone."
        onConfirm={() => setCustomDictionary([])}
        variant="destructive"
      />

      {isEmpty ? (
        /* ─── Empty state ─── */
        <div className="flex-1 flex flex-col items-center justify-center px-8 -mt-4">
          <div className="w-10 h-10 rounded-[10px] bg-gradient-to-b from-primary/8 to-primary/4 dark:from-primary/12 dark:to-primary/6 border border-primary/10 dark:border-primary/15 flex items-center justify-center mb-4">
            <BookOpen
              size={17}
              strokeWidth={1.5}
              className="text-primary/50 dark:text-primary/60"
            />
          </div>

          <h2 className="text-[13px] font-semibold text-foreground mb-1">Custom Dictionary</h2>
          <p className="text-[11px] text-foreground/30 text-center leading-relaxed max-w-[240px] mb-6">
            Teach the AI your vocabulary — names, jargon, and terms it might otherwise miss
          </p>

          <div className="w-full max-w-[260px] relative">
            <Input
              placeholder="Add a word or phrase..."
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
              className="w-full h-8 text-[11px] pr-8 placeholder:text-foreground/20"
            />
            {newWord.trim() ? (
              <button
                onClick={handleAdd}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-primary/50 hover:text-primary transition-colors"
              >
                <CornerDownLeft size={11} />
              </button>
            ) : (
              <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-foreground/12 font-mono select-none pointer-events-none">
                ⏎
              </kbd>
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-3">
            {["OpenWhispr", "Dr. Smith", "gRPC"].map((ex) => (
              <span
                key={ex}
                className="text-[9px] text-foreground/12 px-1.5 py-0.5 rounded-[4px] border border-dashed border-foreground/6 dark:border-white/5"
              >
                {ex}
              </span>
            ))}
          </div>

          <div className="mt-8 w-full max-w-[260px]">
            <button
              onClick={() => setShowInfo(!showInfo)}
              className="flex items-center gap-1 text-[9px] text-foreground/15 hover:text-foreground/30 transition-colors mx-auto"
            >
              <Info size={9} />
              How it works
            </button>
            {showInfo && (
              <div className="mt-2.5 rounded-md bg-foreground/[0.02] dark:bg-white/[0.02] border border-foreground/5 dark:border-white/4 px-3 py-2.5">
                <p className="text-[9px] text-foreground/25 leading-[1.6]">
                  Words are fed as context hints to the speech model, helping it recognize uncommon
                  terms. For difficult words, try adding context like{" "}
                  <span className="text-foreground/35">"The word is Synty"</span> alongside the word
                  itself.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ─── Populated state ─── */
        <>
          <div className="px-5 pt-4 pb-2.5 flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <h2 className="text-[13px] font-semibold text-foreground">Dictionary</h2>
              <span className="text-[10px] text-foreground/15 font-mono tabular-nums">
                {customDictionary.length}
              </span>
            </div>
            <button
              onClick={() => setConfirmClear(true)}
              className="text-[9px] text-foreground/15 hover:text-destructive/70 transition-colors"
            >
              Clear all
            </button>
          </div>

          <div className="px-5 pb-3">
            <div className="relative">
              <Input
                placeholder="Add word or phrase..."
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                }}
                className="w-full h-7 text-[11px] pr-8 placeholder:text-foreground/20"
              />
              {newWord.trim() ? (
                <button
                  onClick={handleAdd}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-primary/50 hover:text-primary transition-colors"
                >
                  <CornerDownLeft size={10} />
                </button>
              ) : (
                <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-foreground/12 font-mono select-none pointer-events-none">
                  ⏎
                </kbd>
              )}
            </div>
          </div>

          <div className="mx-5 h-px bg-border/8 dark:bg-white/3" />

          <div className="flex-1 overflow-y-auto px-5 py-3">
            <div className="flex flex-wrap gap-1.5">
              {customDictionary.map((word) => (
                <span
                  key={word}
                  className="group inline-flex items-center gap-1 pl-2.5 pr-1 py-[3px]
                    bg-foreground/[0.02] dark:bg-white/[0.03]
                    text-foreground/60 dark:text-foreground/50
                    rounded-[5px] text-[11px]
                    border border-foreground/8 dark:border-white/6
                    transition-all duration-150
                    hover:border-foreground/15 dark:hover:border-white/12
                    hover:bg-foreground/[0.04] dark:hover:bg-white/[0.06]
                    hover:text-foreground/80 dark:hover:text-foreground/70"
                >
                  {word}
                  <button
                    onClick={() => handleRemove(word)}
                    className="p-0.5 rounded-sm
                      opacity-0 group-hover:opacity-100
                      text-foreground/25 hover:!text-destructive/70
                      transition-all duration-150"
                  >
                    <X size={10} strokeWidth={2} />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="px-5 pb-3 flex items-start gap-1.5">
            <Info size={9} className="text-foreground/10 mt-px shrink-0" />
            <p className="text-[9px] text-foreground/12 leading-relaxed">
              Separate multiple words with commas. Add context phrases like "The word is Synty" for
              better recognition.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
