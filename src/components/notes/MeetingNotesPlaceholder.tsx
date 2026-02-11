import { Users } from "lucide-react";

export default function MeetingNotesPlaceholder() {
  return (
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
  );
}
