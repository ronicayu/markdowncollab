"use client";

import { useState, useEffect, useRef } from "react";

interface TemplateVariableDialogProps {
  open: boolean;
  variables: string[];
  templateName: string;
  onConfirm: (values: Record<string, string>) => void;
  onCancel: () => void;
}

function formatLabel(variable: string): string {
  return variable.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function TemplateVariableDialog({
  open,
  variables,
  templateName,
  onConfirm,
  onCancel,
}: TemplateVariableDialogProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const initial: Record<string, string> = {};
      for (const v of variables) {
        initial[v] = "";
      }
      setValues(initial);
      setTimeout(() => firstInputRef.current?.focus(), 100);
    }
  }, [open, variables]);

  if (!open) return null;

  const allFilled = variables.every((v) => values[v]?.trim());

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-xl shadow-xl mx-4 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            Template Variables
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Fill in the variables for <strong>{templateName}</strong>
          </p>
        </div>
        <div className="px-5 py-4 space-y-3">
          {variables.map((variable, i) => (
            <div key={variable}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {formatLabel(variable)}
              </label>
              <input
                ref={i === 0 ? firstInputRef : undefined}
                type="text"
                value={values[variable] || ""}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [variable]: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && allFilled) onConfirm(values);
                  if (e.key === "Escape") onCancel();
                }}
                placeholder={`Enter ${formatLabel(variable).toLowerCase()}...`}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#B8692A] focus:ring-1 focus:ring-[#B8692A]"
              />
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(values)}
            disabled={!allFilled}
            className="px-3 py-1.5 text-sm font-medium text-white bg-[#B8692A] hover:bg-[#96541F] rounded-lg transition-colors disabled:opacity-40"
          >
            Create Document
          </button>
        </div>
      </div>
    </div>
  );
}
