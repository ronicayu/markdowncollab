"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Editor } from "@tiptap/core";
import { findParentNode } from "@tiptap/core";

interface TableSortMenuProps {
  editor: Editor;
}

type SortDir = "asc" | "desc";

interface SortState {
  colIndex: number;
  dir: SortDir;
}

/**
 * Floating "Sort Table" button + dropdown that appears when the cursor is in a table.
 * Sorts rows by column values using a Tiptap transaction.
 */
export default function TableSortMenu({ editor }: TableSortMenuProps) {
  const [isInTable, setIsInTable] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [colCount, setColCount] = useState(0);
  const [colHeaders, setColHeaders] = useState<string[]>([]);
  const [currentSort, setCurrentSort] = useState<SortState | null>(null);
  const [btnPos, setBtnPos] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  // Track cursor position relative to table
  useEffect(() => {
    const updateState = () => {
      const { state } = editor;
      const tableType = state.schema.nodes.table;
      if (!tableType) {
        setIsInTable(false);
        return;
      }

      const result = findParentNode((node) => node.type === tableType)(state.selection);
      if (!result) {
        setIsInTable(false);
        setMenuOpen(false);
        return;
      }

      setIsInTable(true);

      // Get column count and headers from the table
      const tableNode = result.node;
      const firstRow = tableNode.child(0);
      if (!firstRow) return;

      const cols = firstRow.childCount;
      setColCount(cols);

      const headers: string[] = [];
      for (let c = 0; c < cols; c++) {
        const cell = firstRow.child(c);
        headers.push(cell.textContent.trim() || `Column ${c + 1}`);
      }
      setColHeaders(headers);

      // Position the button near the top-right of the table
      try {
        const coords = editor.view.coordsAtPos(result.pos + 1);
        setBtnPos({
          top: coords.top - 36,
          left: coords.left,
        });
      } catch {
        // coords can fail if position is not visible
      }
    };

    editor.on("selectionUpdate", updateState);
    editor.on("update", updateState);
    return () => {
      editor.off("selectionUpdate", updateState);
      editor.off("update", updateState);
    };
  }, [editor]);

  const sortTable = useCallback(
    (colIndex: number, dir: SortDir) => {
      const { state } = editor;
      const tableType = state.schema.nodes.table;
      const tableRowType = state.schema.nodes.tableRow;
      if (!tableType || !tableRowType) return;

      const result = findParentNode((node) => node.type === tableType)(state.selection);
      if (!result) return;

      const tableNode = result.node;
      const tablePos = result.pos;

      // Separate header rows from data rows
      const headerRows: typeof tableNode.content.content = [];
      const dataRows: typeof tableNode.content.content = [];

      tableNode.forEach((row, _offset, index) => {
        // First row with tableHeader cells is the header
        if (index === 0) {
          let hasHeader = false;
          row.forEach((cell) => {
            if (cell.type.name === "tableHeader") hasHeader = true;
          });
          if (hasHeader) {
            headerRows.push(row);
            return;
          }
        }
        dataRows.push(row);
      });

      if (dataRows.length <= 1) return; // Nothing to sort

      // Extract sort values
      const rowsWithValues = dataRows.map((row) => {
        const cell = colIndex < row.childCount ? row.child(colIndex) : null;
        const text = cell ? cell.textContent.trim() : "";
        return { row, text };
      });

      // Sort: try numeric first, fall back to string
      rowsWithValues.sort((a, b) => {
        const numA = parseFloat(a.text);
        const numB = parseFloat(b.text);
        const bothNumeric = !isNaN(numA) && !isNaN(numB);

        let cmp: number;
        if (bothNumeric) {
          cmp = numA - numB;
        } else {
          cmp = a.text.localeCompare(b.text, undefined, { sensitivity: "base" });
        }
        return dir === "desc" ? -cmp : cmp;
      });

      // Rebuild the table with sorted rows
      const allRows = [...headerRows, ...rowsWithValues.map((r) => r.row)];
      const newTable = tableType.create(tableNode.attrs, allRows);

      // Replace the table node
      const tr = state.tr.replaceWith(
        tablePos,
        tablePos + tableNode.nodeSize,
        newTable
      );
      editor.view.dispatch(tr);
      setCurrentSort({ colIndex, dir });
      setMenuOpen(false);
    },
    [editor]
  );

  if (!isInTable || !btnPos) return null;

  return (
    <div
      ref={menuRef}
      style={{ position: "fixed", top: btnPos.top, left: btnPos.left, zIndex: 50 }}
    >
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 shadow-sm transition-colors"
        title="Sort table"
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M3 12h12M3 17h6" />
        </svg>
        Sort
        {currentSort && (
          <span className="text-[10px] text-gray-400">
            ({colHeaders[currentSort.colIndex]?.slice(0, 8)} {currentSort.dir === "asc" ? "\u25B2" : "\u25BC"})
          </span>
        )}
      </button>

      {menuOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 w-52 z-50">
          <p className="px-3 py-1 text-[10px] font-medium text-gray-400 uppercase tracking-wide">
            Sort by column
          </p>
          {colHeaders.map((header, i) => (
            <div key={i} className="flex items-center">
              <button
                onClick={() => sortTable(i, "asc")}
                className={`flex-1 flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors ${
                  currentSort?.colIndex === i && currentSort.dir === "asc"
                    ? "bg-amber-50 text-[#B8692A] font-medium"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span className="truncate">{header}</span>
                <span className="text-[10px] text-gray-400 ml-auto shrink-0">{"\u25B2"}</span>
              </button>
              <button
                onClick={() => sortTable(i, "desc")}
                className={`px-2 py-1.5 text-sm transition-colors ${
                  currentSort?.colIndex === i && currentSort.dir === "desc"
                    ? "bg-amber-50 text-[#B8692A] font-medium"
                    : "text-gray-400 hover:bg-gray-50 hover:text-gray-700"
                }`}
              >
                <span className="text-[10px]">{"\u25BC"}</span>
              </button>
            </div>
          ))}
          {currentSort && (
            <>
              <div className="border-t border-gray-100 my-1" />
              <button
                onClick={() => { setCurrentSort(null); setMenuOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Clear sort
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
