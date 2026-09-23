export function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    try {
      anchor.click();
    } finally {
      anchor.remove();
    }
  } finally {
    // Keep the URL alive long enough for browsers to start the download.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
