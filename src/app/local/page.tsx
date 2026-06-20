"use client";

import { useEffect, useState, useCallback, useRef, ChangeEvent } from "react";
import Link from "next/link";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import { TextAlign } from "@tiptap/extension-text-align";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import * as TablePkg from "@tiptap/extension-table";
import { Markdown } from "tiptap-markdown";
import { toast } from "@/lib/toast";
import {
  isFileSystemAccessSupported,
  fileNameToTitle,
  openLocalMarkdown,
  writeLocalMarkdown,
  pickSaveLocation,
  downloadMarkdown,
  takePendingLocalFile,
  type LocalMarkdownFile,
} from "@/lib/local-file";

const { Table, TableRow, TableCell, TableHeader } = TablePkg;

export default function LocalFilePage() {
  const [handle, setHandle] = useState<FileSystemFileHandle | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [supported, setSupported] = useState(true);

  // Suppress the dirty flag while we load content programmatically.
  const loadingRef = useRef(false);
  const pendingConsumedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { class: "editor-link" },
        },
      }),
      Placeholder.configure({ placeholder: "Open a markdown file to start editing…" }),
      Markdown.configure({ html: true, transformPastedText: true, transformCopiedText: true }),
      Table.configure({ resizable: false, HTMLAttributes: { class: "editor-table" } }),
      TableRow,
      TableCell,
      TableHeader,
      Image.configure({ allowBase64: true, HTMLAttributes: { class: "editor-image" } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    editorProps: { attributes: { class: "ProseMirror focus:outline-none" } },
    onUpdate: () => {
      if (!loadingRef.current) setDirty(true);
    },
  });

  useEffect(() => {
    setSupported(isFileSystemAccessSupported());
  }, []);

  const applyFile = useCallback(
    (file: LocalMarkdownFile) => {
      if (!editor) return;
      loadingRef.current = true;
      editor.commands.setContent(file.text || "");
      loadingRef.current = false;
      setHandle(file.handle);
      setFileName(file.name);
      setOpened(true);
      setDirty(false);
      setTimeout(() => editor.commands.focus("start"), 50);
    },
    [editor]
  );

  // Consume a file handed off from the home page once the editor is ready.
  useEffect(() => {
    if (!editor || pendingConsumedRef.current) return;
    pendingConsumedRef.current = true;
    const pending = takePendingLocalFile();
    if (pending) applyFile(pending);
  }, [editor, applyFile]);

  const handleOpen = useCallback(async () => {
    if (dirty && !confirm("Discard unsaved changes and open another file?")) return;
    if (isFileSystemAccessSupported()) {
      try {
        const file = await openLocalMarkdown();
        if (file) applyFile(file);
      } catch {
        toast("Couldn't open the file", "error");
      }
    } else {
      inputRef.current?.click();
    }
  }, [dirty, applyFile]);

  const handleInputChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) applyFile({ handle: null, name: file.name, text: await file.text() });
      if (inputRef.current) inputRef.current.value = "";
    },
    [applyFile]
  );

  const handleSave = useCallback(async () => {
    if (!editor || !opened) return;
    const md = (editor.storage as { markdown?: { getMarkdown(): string } }).markdown?.getMarkdown() ?? "";
    setSaving(true);
    try {
      if (handle) {
        await writeLocalMarkdown(handle, md);
        setDirty(false);
        toast("Saved to disk");
      } else if (isFileSystemAccessSupported()) {
        // Fallback-opened file (no handle): ask where to put it.
        const target = await pickSaveLocation(fileName ?? "untitled.md");
        if (!target) return;
        await writeLocalMarkdown(target, md);
        setHandle(target);
        setFileName(target.name);
        setDirty(false);
        toast("Saved to disk");
      } else {
        downloadMarkdown(fileName ?? "untitled.md", md);
        toast("Downloaded a copy");
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save the file", "error");
    } finally {
      setSaving(false);
    }
  }, [editor, opened, handle, fileName]);

  const handleSaveAs = useCallback(async () => {
    if (!editor || !opened || !isFileSystemAccessSupported()) return;
    const md = (editor.storage as { markdown?: { getMarkdown(): string } }).markdown?.getMarkdown() ?? "";
    setSaving(true);
    try {
      const target = await pickSaveLocation(fileName ?? "untitled.md");
      if (!target) return;
      await writeLocalMarkdown(target, md);
      setHandle(target);
      setFileName(target.name);
      setDirty(false);
      toast("Saved a copy");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save the file", "error");
    } finally {
      setSaving(false);
    }
  }, [editor, opened, fileName]);

  // Cmd/Ctrl+S to save.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handleSave]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const title = fileName ? fileNameToTitle(fileName) : "Local file";
  const canSave = opened && (dirty || !handle);

  return (
    <div id="main-content" className="flex h-screen flex-col bg-[#ffffff]">
      <input
        ref={inputRef}
        type="file"
        accept=".md,.markdown,.mdown,.mkd,.txt,text/markdown"
        className="hidden"
        onChange={handleInputChange}
      />

      {/* Top bar — mirrors the document TopBar palette */}
      <header className="flex items-center justify-between gap-3 px-4 py-2.5 bg-white border-b border-black/10 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href="/"
            className="flex items-center justify-center h-8 w-8 rounded-md text-[#615d59] hover:text-[#31302e] hover:bg-[#f6f5f4] transition-colors shrink-0"
            title="Back to documents"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-sm font-semibold text-[#31302e] truncate">{title}</span>
              {dirty && (
                <span className="h-1.5 w-1.5 rounded-full bg-[#0075de] shrink-0" title="Unsaved changes" />
              )}
            </div>
            <p className="text-[11px] text-[#a39e98] truncate [font-family:var(--font-mono)]">
              {opened ? "On disk · not synced" : "No file open"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleOpen}
            className="flex items-center gap-1.5 border border-[#dddddd] text-[#31302e] hover:border-[#a39e98] px-3 py-1.5 rounded text-sm font-medium transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span className="hidden sm:inline">Open</span>
          </button>
          {opened && supported && (
            <button
              onClick={handleSaveAs}
              disabled={saving}
              className="hidden sm:flex items-center gap-1.5 border border-[#dddddd] text-[#31302e] hover:border-[#a39e98] px-3 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50"
            >
              Save As
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="flex items-center gap-1.5 bg-[#0075de] hover:bg-[#005bab] text-white px-3 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
            <span className="hidden sm:inline">{saving ? "Saving…" : "Save"}</span>
          </button>
        </div>
      </header>

      {!supported && (
        <div className="px-4 py-2 bg-[#fbf7ef] border-b border-black/5 text-xs text-[#615d59] shrink-0">
          Your browser can&rsquo;t save back to the original file. Opening uses a file dialog, and Save downloads an
          edited copy. For in-place editing, use Chrome or Edge.
        </div>
      )}

      {/* Editor / empty state */}
      <main className="flex-1 overflow-y-auto">
        {opened ? (
          <div className="mx-auto max-w-3xl px-6 py-10">
            <EditorContent editor={editor} />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center px-6">
            <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-[#f6f5f4] mb-4">
              <svg className="h-7 w-7 text-[#a39e98]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <h1 className="text-lg font-semibold text-[#31302e]">Open a markdown file</h1>
            <p className="text-sm text-[#615d59] mt-1 max-w-sm">
              Edit a <code className="text-[#31302e]">.md</code> file straight from your disk and save changes back to it.
              Nothing is uploaded or shared.
            </p>
            <button
              onClick={handleOpen}
              className="mt-5 flex items-center gap-2 bg-[#0075de] hover:bg-[#005bab] text-white px-4 py-2 rounded text-sm font-medium transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              Open file
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
