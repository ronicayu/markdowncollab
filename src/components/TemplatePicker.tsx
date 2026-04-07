"use client";

import { useEffect, useState } from "react";

interface TemplateItem {
  id: string;
  name: string;
  description: string;
  icon: string;
}

interface CustomTemplateItem {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

interface TemplatePickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (templateId: string) => void;
}

export default function TemplatePicker({ open, onClose, onSelect }: TemplatePickerProps) {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [customTemplates, setCustomTemplates] = useState<CustomTemplateItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      fetch("/api/templates").then((r) => r.json()),
      fetch("/api/templates/custom").then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ])
      .then(([builtIn, custom]) => {
        setTemplates(builtIn);
        setCustomTemplates(custom);
      })
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      data-testid="template-picker-backdrop"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-picker-title"
        className="bg-white rounded-xl shadow-xl p-6 mx-4 max-w-lg w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="template-picker-title" className="text-lg font-semibold text-gray-900 mb-1">Choose a template</h2>
        <p className="text-sm text-gray-500 mb-4">Start with a structure or go blank.</p>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-gray-50 rounded-lg px-4 py-3 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-full" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {customTemplates.length > 0 && (
              <div className="mb-5">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Your Templates</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {customTemplates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => onSelect(`custom:${t.id}`)}
                      className="flex items-start gap-3 text-left bg-amber-50/60 rounded-lg px-4 py-3 border border-transparent hover:border-[#B8692A] hover:shadow-sm transition-all group"
                    >
                      <span className="text-xl shrink-0 mt-0.5">{"\uD83D\uDCC4"}</span>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 text-sm group-hover:text-[#B8692A] transition-colors">
                          {t.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{t.description || "Custom template"}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              {customTemplates.length > 0 && (
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Built-in Templates</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onSelect(t.id)}
                    className="flex items-start gap-3 text-left bg-[#FFFEF9] rounded-lg px-4 py-3 border border-transparent hover:border-[#B8692A] hover:shadow-sm transition-all group"
                  >
                    <span className="text-xl shrink-0 mt-0.5">{t.icon}</span>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 text-sm group-hover:text-[#B8692A] transition-colors">
                        {t.name}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
