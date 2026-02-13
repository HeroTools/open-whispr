export function openExternalLink(url: string): void {
  if (window.electronAPI?.openExternal) {
    window.electronAPI.openExternal(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export function createExternalLinkHandler(url: string) {
  return (e: React.MouseEvent) => {
    e.preventDefault();
    openExternalLink(url);
  };
}
