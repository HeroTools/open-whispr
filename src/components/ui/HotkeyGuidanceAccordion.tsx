import React, { useState } from "react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "./accordion";
import {
  VALIDATION_RULES,
  getRecommendedPatterns,
  getReservedShortcuts,
  getValidExamples,
  type Platform,
} from "../../utils/hotkeyValidator";
import { formatHotkeyLabelForPlatform } from "../../utils/hotkeys";

type AccordionPlatform = "macos" | "windows" | "linux";

const PLATFORM_MAP: Record<AccordionPlatform, Platform> = {
  macos: "darwin",
  windows: "win32",
  linux: "linux",
};

const PLATFORM_LABELS: Record<AccordionPlatform, string> = {
  macos: "macOS",
  windows: "Windows",
  linux: "Linux",
};

interface HotkeyGuidanceAccordionProps {
  defaultValue?: AccordionPlatform;
  className?: string;
}

export function HotkeyGuidanceAccordion({
  defaultValue,
  className = "",
}: HotkeyGuidanceAccordionProps) {
  const [showAll, setShowAll] = useState<Record<AccordionPlatform, boolean>>({
    macos: false,
    windows: false,
    linux: false,
  });

  const renderReserved = (platformKey: AccordionPlatform) => {
    const platform = PLATFORM_MAP[platformKey];
    const reserved = getReservedShortcuts(platform);
    const formatted = reserved.map((shortcut) =>
      formatHotkeyLabelForPlatform(shortcut, platform)
    );
    const unique = Array.from(new Set(formatted));
    const displayCount = 8;
    const visible = showAll[platformKey] ? unique : unique.slice(0, displayCount);
    const hasMore = unique.length > displayCount;

    return (
      <div className="space-y-2">
        <p className="text-xs text-gray-500">
          These shortcuts are blocked because they are commonly used by the system.
        </p>
        <ul className="flex flex-wrap gap-2">
          {visible.map((shortcut) => (
            <li key={`${platformKey}-${shortcut}`}>
              <kbd className="px-2 py-1 text-xs font-mono bg-gray-100 border border-gray-200 rounded">
                {shortcut}
              </kbd>
            </li>
          ))}
        </ul>
        {hasMore && (
          <button
            type="button"
            onClick={() =>
              setShowAll((prev) => ({
                ...prev,
                [platformKey]: !prev[platformKey],
              }))
            }
            className="text-xs text-indigo-600 hover:text-indigo-700"
          >
            {showAll[platformKey] ? "Show fewer" : "Show all"}
          </button>
        )}
      </div>
    );
  };

  const renderSection = (platformKey: AccordionPlatform) => {
    const platform = PLATFORM_MAP[platformKey];
    const recommended = getRecommendedPatterns(platform);
    const examples = getValidExamples(platform);
    const formattedExamples = examples.map((example) =>
      formatHotkeyLabelForPlatform(example, platform)
    );

    return (
      <AccordionItem value={platformKey}>
        <AccordionTrigger>{PLATFORM_LABELS[platformKey]}</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-800 mb-2">Recommended shortcuts</h4>
              <ul className="space-y-1 text-sm text-gray-700">
                {recommended.map((pattern) => (
                  <li key={`${platformKey}-${pattern}`}>{pattern}</li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-800 mb-2">Shortcut rules</h4>
              <ul className="space-y-1 text-sm text-gray-700">
                {VALIDATION_RULES.map((rule) => (
                  <li key={`${platformKey}-${rule}`}>{rule}</li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-800 mb-2">Blocked shortcuts</h4>
              {renderReserved(platformKey)}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-800 mb-2">Valid examples</h4>
              <ul className="flex flex-wrap gap-2">
                {formattedExamples.map((example) => (
                  <li key={`${platformKey}-${example}`}>
                    <kbd className="px-2 py-1 text-xs font-mono bg-gray-100 border border-gray-200 rounded">
                      {example}
                    </kbd>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  };

  return (
    <div className={`border border-gray-200 rounded-xl bg-gray-50 p-4 ${className}`}>
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Shortcut Guide</h3>
        <p className="text-xs text-gray-600">
          Use these platform rules to choose a shortcut that won’t conflict with your system.
        </p>
      </div>
      <Accordion type="single" collapsible defaultValue={defaultValue}>
        {renderSection("macos")}
        {renderSection("windows")}
        {renderSection("linux")}
      </Accordion>
    </div>
  );
}

export default HotkeyGuidanceAccordion;
