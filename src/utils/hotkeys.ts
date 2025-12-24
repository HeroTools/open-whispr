export function formatHotkeyLabel(hotkey?: string | null): string {
  if (!hotkey || hotkey.trim() === "") {
    return "`";
  }

  if (hotkey === "GLOBE") {
    return "🌐 Globe";
  }

  // Check if we're on macOS
  const isMac = typeof navigator !== "undefined" && /Mac|Darwin/.test(navigator.platform);

  // Format combination hotkeys with appropriate symbols
  let formatted = hotkey;

  if (isMac) {
    // Replace with Mac symbols
    formatted = formatted
      .replace(/CommandOrControl/g, "⌘")
      .replace(/Command/g, "⌘")
      .replace(/Cmd/g, "⌘")
      .replace(/Alt/g, "⌥")
      .replace(/Option/g, "⌥")
      .replace(/Shift/g, "⇧")
      .replace(/Control/g, "⌃")
      .replace(/Ctrl/g, "⌃");
  } else {
    // Replace with Windows/Linux labels
    formatted = formatted
      .replace(/CommandOrControl/g, "Ctrl")
      .replace(/Command/g, "Win")
      .replace(/Cmd/g, "Win");
  }

  return formatted;
}
