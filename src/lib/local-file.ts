// Open and save local markdown files on disk via the File System Access API.
//
// This is deliberately separate from the server-side Import flow (which uploads a
// file, creates a Document row, and starts a Yjs collaboration session). Here the
// file stays on the user's disk: we read it, edit it locally, and write changes
// back to the same file handle — no server, no database, no collaboration.

export interface LocalMarkdownFile {
  /** Live handle for save-back. Null when opened via the <input> fallback. */
  handle: FileSystemFileHandle | null;
  name: string;
  text: string;
}

export const MARKDOWN_PICKER_TYPES: FilePickerAcceptType[] = [
  {
    description: "Markdown",
    accept: { "text/markdown": [".md", ".markdown", ".mdown", ".mkd"] },
  },
];

/** True when the browser can open/save files in place (Chromium, Edge). */
export function isFileSystemAccessSupported(): boolean {
  return typeof window !== "undefined" && "showOpenFilePicker" in window;
}

/** Strip a markdown extension to derive a human-friendly document title. */
export function fileNameToTitle(name: string): string {
  return name.replace(/\.(md|markdown|mdown|mkd|txt)$/i, "") || name;
}

/**
 * Show the open-file picker and read the chosen markdown file.
 * Returns null if the user cancels the picker.
 */
export async function openLocalMarkdown(): Promise<LocalMarkdownFile | null> {
  try {
    const [handle] = await window.showOpenFilePicker({
      types: MARKDOWN_PICKER_TYPES,
      multiple: false,
    });
    const file = await handle.getFile();
    return { handle, name: file.name, text: await file.text() };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return null;
    throw err;
  }
}

/** Ensure we hold read-write permission, prompting the user if needed. */
export async function verifyReadWritePermission(
  handle: FileSystemFileHandle
): Promise<boolean> {
  const opts: FileSystemHandlePermissionDescriptor = { mode: "readwrite" };
  if ((await handle.queryPermission(opts)) === "granted") return true;
  return (await handle.requestPermission(opts)) === "granted";
}

/** Write text back to an existing file handle. */
export async function writeLocalMarkdown(
  handle: FileSystemFileHandle,
  text: string
): Promise<void> {
  if (!(await verifyReadWritePermission(handle))) {
    throw new Error("Permission to write the file was denied.");
  }
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

/**
 * Show the save-file picker to choose a new location (Save As / first save of a
 * fallback-opened file). Returns null if the user cancels.
 */
export async function pickSaveLocation(
  suggestedName: string
): Promise<FileSystemFileHandle | null> {
  try {
    return await window.showSaveFilePicker({
      suggestedName,
      types: MARKDOWN_PICKER_TYPES,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return null;
    throw err;
  }
}

/** Fallback "save" for browsers without the File System Access API. */
export function downloadMarkdown(name: string, text: string): void {
  const blob = new Blob([text], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = /\.(md|markdown|mdown|mkd|txt)$/i.test(name) ? name : `${name}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// --- Cross-route handoff -----------------------------------------------------
// A FileSystemFileHandle can't ride along in a URL or sessionStorage, so when the
// home page opens a file we stash the result in module memory and the /local page
// picks it up on mount. This survives client-side navigation (same JS runtime)
// but not a hard reload — the /local page always offers its own Open button too.

let pendingFile: LocalMarkdownFile | null = null;

export function setPendingLocalFile(file: LocalMarkdownFile): void {
  pendingFile = file;
}

export function takePendingLocalFile(): LocalMarkdownFile | null {
  const file = pendingFile;
  pendingFile = null;
  return file;
}
