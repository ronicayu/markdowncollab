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
        <div className="px-5 py-4 border-b border-[rgba(0,0,0,0.1)]">
          <h2 className="text-base font-semibold text-[#31302e]">
            Template Variables
          </h2>
          <p className="text-sm text-[#615d59] mt-0.5">
            Fill in the variables for <strong>{templateName}</strong>
          </p>
        </div>
        <div className="px-5 py-4 space-y-3">
          {variables.map((variable, i) => (
            <div key={variable}>
              <label className="block text-sm font-medium text-[#31302e] mb-1">
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
                className="w-full border border-[rgba(0,0,0,0.1)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0075de] focus:ring-1 focus:ring-[#0075de]"
              />
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-[rgba(0,0,0,0.1)] flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-[#615d59] hover:text-[#31302e] border border-[rgba(0,0,0,0.1)] rounded-lg hover:bg-[#f6f5f4] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(values)}
            disabled={!allFilled}
            className="px-3 py-1.5 text-sm font-medium text-white bg-[#0075de] hover:bg-[#005bab] rounded-lg transition-colors disabled:opacity-40"
          >
            Create Document
          </button>
        </div>
      </div>
    </div>
  );
}
