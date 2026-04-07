"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import type * as Y from "yjs";

interface PinnedNote {
  id: string;
  content: string;
  author: string;
  color: string;
  createdAt: string;
}

const NOTE_COLORS = [
  { name: "yellow", bg: "#fef3c7", border: "#f59e0b" },
  { name: "blue", bg: "#dbeafe", border: "#3b82f6" },
  { name: "pink", bg: "#fce7f3", border: "#ec4899" },
  { name: "green", bg: "#d1fae5", border: "#10b981" },
];

function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

interface PinnedNotesProps {
  ydoc: Y.Doc;
  userName: string;
}

export default function PinnedNotes({ ydoc, userName }: PinnedNotesProps) {
  const [notes, setNotes] = useState<PinnedNote[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [newNoteColor, setNewNoteColor] = useState(NOTE_COLORS[0].bg);
  const editInputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  const yArray = useRef<Y.Array<PinnedNote> | null>(null);

  const syncNotes = useCallback(() => {
    if (!yArray.current) return;
    const arr: PinnedNote[] = [];
    for (let i = 0; i < yArray.current.length; i++) {
      arr.push(yArray.current.get(i));
    }
    setNotes(arr);
  }, []);

  useEffect(() => {
    const arr = ydoc.getArray<PinnedNote>("pinnedNotes");
    yArray.current = arr;
    syncNotes();
    arr.observe(syncNotes);
    return () => {
      arr.unobserve(syncNotes);
    };
  }, [ydoc, syncNotes]);

  const handleAdd = () => {
    if (!newNoteText.trim() || !yArray.current) return;
    const note: PinnedNote = {
      id: generateId(),
      content: newNoteText.trim(),
      author: userName,
      color: newNoteColor,
      createdAt: new Date().toISOString(),
    };
    yArray.current.push([note]);
    setNewNoteText("");
    setAddingNote(false);
  };

  const handleDelete = (noteId: string) => {
    if (!yArray.current) return;
    for (let i = 0; i < yArray.current.length; i++) {
      if (yArray.current.get(i).id === noteId) {
        yArray.current.delete(i, 1);
        break;
      }
    }
  };

  const handleEditStart = (note: PinnedNote) => {
    setEditingId(note.id);
    setEditText(note.content);
    setTimeout(() => editInputRef.current?.focus(), 0);
  };

  const handleEditSave = () => {
    if (!editingId || !yArray.current) return;
    for (let i = 0; i < yArray.current.length; i++) {
      const existing = yArray.current.get(i);
      if (existing.id === editingId) {
        yArray.current.delete(i, 1);
        yArray.current.insert(i, [{ ...existing, content: editText.trim() || existing.content }]);
        break;
      }
    }
    setEditingId(null);
    setEditText("");
  };

  if (notes.length === 0 && !addingNote) {
    return (
      <div className="pinned-notes-bar flex items-center gap-2 px-4 py-1.5 bg-[#FFFEF9]/60 border-b border-gray-100">
        <button
          onClick={() => {
            setAddingNote(true);
            setTimeout(() => addInputRef.current?.focus(), 0);
          }}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
          title="Add a pinned note"
        >
          <span className="text-base leading-none">+</span>
          <span>Add note</span>
        </button>
      </div>
    );
  }

  return (
    <div className="pinned-notes-bar flex items-center gap-2 px-4 py-2 bg-[#FFFEF9]/60 border-b border-gray-100 overflow-x-auto">
      {notes.map((note) => (
        <div
          key={note.id}
          className="pinned-note shrink-0 rounded-md px-3 py-1.5 text-xs max-w-[200px] relative group cursor-pointer"
          style={{ backgroundColor: note.color, borderLeft: `3px solid ${NOTE_COLORS.find(c => c.bg === note.color)?.border || "#d1d5db"}` }}
          onClick={() => handleEditStart(note)}
          title={`By ${note.author}`}
        >
          {editingId === note.id ? (
            <input
              ref={editInputRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={handleEditSave}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleEditSave();
                if (e.key === "Escape") { setEditingId(null); setEditText(""); }
              }}
              className="w-full bg-transparent border-none outline-none text-xs text-gray-800"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="text-gray-800 truncate block">{note.content}</span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(note.id); }}
            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-gray-400 text-white text-[10px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
            title="Delete note"
          >
            x
          </button>
        </div>
      ))}

      {addingNote ? (
        <div className="shrink-0 flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 py-1">
          <div className="flex gap-1">
            {NOTE_COLORS.map((c) => (
              <button
                key={c.name}
                onClick={() => setNewNoteColor(c.bg)}
                className={`w-4 h-4 rounded-full border-2 ${newNoteColor === c.bg ? "border-gray-600" : "border-transparent"}`}
                style={{ backgroundColor: c.bg }}
                title={c.name}
              />
            ))}
          </div>
          <input
            ref={addInputRef}
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
              if (e.key === "Escape") { setAddingNote(false); setNewNoteText(""); }
            }}
            placeholder="Note text..."
            className="w-32 text-xs border-none outline-none bg-transparent"
          />
          <button
            onClick={handleAdd}
            className="text-xs font-medium text-amber-700 hover:text-amber-900"
          >
            Add
          </button>
        </div>
      ) : (
        <button
          onClick={() => {
            setAddingNote(true);
            setTimeout(() => addInputRef.current?.focus(), 0);
          }}
          className="shrink-0 w-6 h-6 rounded-md border border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors text-sm"
          title="Add a pinned note"
        >
          +
        </button>
      )}
    </div>
  );
}
