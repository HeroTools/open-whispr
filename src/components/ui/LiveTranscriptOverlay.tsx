import { useEffect, useRef } from "react";

interface LiveTranscriptOverlayProps {
  text: string;
  isVisible: boolean;
}

export function LiveTranscriptOverlay({ text, isVisible }: LiveTranscriptOverlayProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [text]);

  if (!isVisible || !text) {
    return null;
  }

  return (
    <div
      ref={scrollRef}
      className="max-w-[400px] max-h-[120px] overflow-y-auto px-3 py-2 text-sm text-white/90 bg-black/60 backdrop-blur-sm rounded-lg pointer-events-none select-none"
    >
      {text}
    </div>
  );
}
