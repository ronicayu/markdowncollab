import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import ToastProvider from "@/components/ToastProvider";
import SessionProvider from "@/components/SessionProvider";
import ThemeWrapper from "@/components/ThemeWrapper";
import GlobalCommandPalette from "@/components/GlobalCommandPalette";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import OfflineIndicator from "@/components/OfflineIndicator";
import RecentDocs from "@/components/RecentDocs";

import KeyboardDocCreate from "@/components/KeyboardDocCreate";
import { I18nProvider } from "@/lib/i18n";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MarkdownCollab",
  description: "Real-time collaborative markdown editing with AI agents",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#B8692A" />
      </head>
      <body className={jakarta.className} suppressHydrationWarning>
        <SessionProvider>
          <I18nProvider>
          <ThemeWrapper>
            <a href="#main-content" className="skip-to-content">
              Skip to content
            </a>
            {children}
            <GlobalCommandPalette />
            <KeyboardDocCreate />
            <OfflineIndicator />
            <RecentDocs />

            <ServiceWorkerRegistration />
          </ThemeWrapper>
          </I18nProvider>
          <ToastProvider />
        </SessionProvider>
      </body>
    </html>
  );
}

