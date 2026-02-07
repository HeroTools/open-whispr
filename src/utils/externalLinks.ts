/**
 * Opens a URL in the user's default system browser (not inside Electron window)
 */
export function openExternalLink(url: string): void {
  if (window.electronAPI?.openExternal) {
    window.electronAPI.openExternal(url);
  } else {
    // Fallback for non-Electron environments (development, etc.)
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/**
 * Returns an onClick handler that opens a URL in the default browser
 * Prevents default link behavior to avoid opening in Electron window
 */
export function createExternalLinkHandler<T extends HTMLElement = HTMLElement>(url: string) {
  return (e: React.MouseEvent<T>) => {
    e.preventDefault();
    openExternalLink(url);
  };
}
