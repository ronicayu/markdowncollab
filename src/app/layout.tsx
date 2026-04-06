import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import ToastProvider from "@/components/ToastProvider";
import SessionProvider from "@/components/SessionProvider";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MarkdownCollab",
  description: "Real-time collaborative markdown editing with AI agents",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={jakarta.className} suppressHydrationWarning>
        <SessionProvider>
          {children}
          <ToastProvider />
        </SessionProvider>
      </body>
    </html>
  );
}

