import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <main className="flex flex-col items-center gap-8 text-center">
        <h1 className="font-mono text-4xl font-bold text-gray-900">
          MarkdownCollab
        </h1>
        <p className="max-w-md text-lg text-gray-600">
          Real-time collaborative markdown editing with AI-powered suggestions.
          Write together, suggest changes, and let AI agents help refine your
          documents.
        </p>
        <Link
          href="/doc/test-doc-1"
          className="rounded-md bg-gray-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-800"
        >
          Open Test Document
        </Link>
      </main>
    </div>
  );
}
