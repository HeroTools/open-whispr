import { useTranslation } from "react-i18next";

export default function MeetingNotesPlaceholder() {
  const { t } = useTranslation();
  return (
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
      <h3 className="text-xs font-semibold text-foreground/60 mb-1">{t("notes.meeting.title")}</h3>
      <p className="text-2xs text-foreground/25 text-center max-w-52 mb-3">
        {t("notes.meeting.description")}
      </p>
      <span className="text-[8px] font-semibold uppercase tracking-widest text-primary/40 bg-primary/5 dark:bg-primary/8 px-2.5 py-1 rounded-md border border-primary/8 dark:border-primary/12">
        {t("notes.meeting.comingSoon")}
      </span>
    </div>
  );
}
