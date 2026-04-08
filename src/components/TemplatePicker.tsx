"use client";

import { useEffect, useState } from "react";

interface TemplateItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  content?: string;
}

interface CustomTemplateItem {
  id: string;
  name: string;
  description: string;
  content?: string;
  createdAt: string;
}

interface TemplatePickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (templateId: string) => void;
}

function SimpleMarkdownPreview({ content }: { content: string }) {
  if (!content) {
    return (
      <p className="text-sm text-gray-400 italic">Blank document — no preview available.</p>
    );
  }

  // Very simple markdown-to-html for preview purposes
  const html = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-semibold text-gray-800 mt-3 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-base font-semibold text-gray-900 mt-3 mb-1">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-lg font-bold text-gray-900 mt-2 mb-1">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^- \[ \] (.+)$/gm, '<div class="flex items-center gap-1.5 text-sm text-gray-600"><span class="inline-block w-3.5 h-3.5 border border-gray-300 rounded-sm shrink-0"></span>$1</div>')
    .replace(/^- (.+)$/gm, '<li class="text-sm text-gray-600 ml-4 list-disc">$1</li>')
    .replace(/^\d+\.\s*$/gm, '<li class="text-sm text-gray-400 ml-4 list-decimal italic">...</li>')
    .replace(/^\| (.+) \|$/gm, (match) => {
      const cells = match.replace(/^\| | \|$/g, "").split(" | ");
      return `<div class="flex gap-4 text-sm text-gray-600">${cells.map((c) => `<span class="flex-1">${c}</span>`).join("")}</div>`;
    })
    .replace(/^\| [-|]+ \|$/gm, "")
    .replace(/\{\{date\}\}/g, new Date().toISOString().slice(0, 10));

  return (
    <div
      className="prose prose-sm max-w-none text-gray-700"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default function TemplatePicker({ open, onClose, onSelect }: TemplatePickerProps) {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [customTemplates, setCustomTemplates] = useState<CustomTemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<{ id: string; name: string; content: string; isCustom: boolean } | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSelectedTemplate(null);
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

  function handleCardClick(id: string, name: string, content: string, isCustom: boolean) {
    setSelectedTemplate({ id, name, content, isCustom });
  }

  function handleUseTemplate() {
    if (!selectedTemplate) return;
    const templateId = selectedTemplate.isCustom ? `custom:${selectedTemplate.id}` : selectedTemplate.id;
    onSelect(templateId);
  }

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
        className="bg-white rounded-xl shadow-xl p-6 mx-4 max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="template-picker-title" className="text-lg font-semibold text-gray-900 mb-1">Choose a template</h2>
        <p className="text-sm text-gray-500 mb-4">Start with a structure or go blank. Click a template to preview it.</p>

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
          <div className="flex gap-5 flex-1 min-h-0">
            {/* Template list (left) */}
            <div className="w-1/2 overflow-y-auto pr-2 space-y-4">
              {customTemplates.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Your Templates</p>
                  <div className="grid grid-cols-1 gap-2">
                    {customTemplates.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleCardClick(t.id, t.name, t.content || "", true)}
                        onDoubleClick={() => onSelect(`custom:${t.id}`)}
                        className={`flex items-start gap-3 text-left bg-amber-50/60 rounded-lg px-4 py-3 border transition-all group ${
                          selectedTemplate?.id === t.id && selectedTemplate?.isCustom
                            ? "border-[#B8692A] shadow-sm ring-1 ring-[#B8692A]/30"
                            : "border-transparent hover:border-[#B8692A] hover:shadow-sm"
                        }`}
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
                <div className="grid grid-cols-1 gap-2">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleCardClick(t.id, t.name, t.content || "", false)}
                      onDoubleClick={() => onSelect(t.id)}
                      className={`flex items-start gap-3 text-left bg-[#FFFEF9] rounded-lg px-4 py-3 border transition-all group ${
                        selectedTemplate?.id === t.id && !selectedTemplate?.isCustom
                          ? "border-[#B8692A] shadow-sm ring-1 ring-[#B8692A]/30"
                          : "border-transparent hover:border-[#B8692A] hover:shadow-sm"
                      }`}
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
            </div>

            {/* Preview panel (right) */}
            <div className="w-1/2 border-l border-gray-200 pl-5 flex flex-col min-h-0">
              {selectedTemplate ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900">{selectedTemplate.name}</h3>
                    <button
                      onClick={handleUseTemplate}
                      className="px-3 py-1.5 text-sm font-medium bg-[#B8692A] hover:bg-[#96541F] text-white rounded-lg transition-colors"
                    >
                      Use Template
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto bg-gray-50/50 rounded-lg p-4 border border-gray-100">
                    <SimpleMarkdownPreview content={selectedTemplate.content} />
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-center">
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Select a template to preview</p>
                    <p className="text-xs text-gray-300">Double-click to use immediately</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
